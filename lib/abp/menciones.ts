/**
 * LOS NOMBRES DE LAS CONSIGNAS, ATADOS A SU FICHA (12/11/2026).
 *
 * Lo pidió el analista: «que los textos que aparecen en consignas detecten
 * automáticamente los nombres que aparecen y, según se seleccionen unos
 * jugadores u otros, esos nombres cambien».
 *
 * Cómo se hace sin tocar lo guardado:
 *
 * - **Detectar** (`mencionesDe`): en cada consigna se buscan los nombres de la
 *   plantilla (apodo, nombre completo y apellidos, sin tildes ni mayúsculas y
 *   como palabra entera, ver `formasDe`). Uno que está en la lámina queda
 *   **enlazado** a su ficha; uno de la plantilla que no está, **fuera** (se
 *   deja el texto y se avisa). Si dos de la lámina comparten la palabra (dos
 *   «García»), no se enlaza: no se sabe de quién habla.
 * - **Cambiar** (`enlazaNombres`): cuando, en una diapositiva, la ficha de un
 *   puesto pasa a ser de otro jugador —elegirlo en el selector, soltar una
 *   cara sobre otra, la propuesta de marcas, el grupo entero—, sus menciones
 *   en las consignas y en la señal, la rutina y la intención pasan a decir el
 *   nombre del que entra. Es un cambio más del analista: se guarda y se
 *   deshace con Ctrl+Z como cualquier otro.
 *
 * Lo guardado no se reescribe al cargar: una pizarra vieja abre igual y sus
 * consignas siguen siendo texto. Lo enlazado se calcula cada vez (con quién
 * está en la lámina), así que no hay fichas que se queden atrás.
 *
 * El cambio de todo el tablero (uno sale del once y entra otro en todas las
 * diapositivas, «Poner el once») ya cambiaba los textos por su cuenta
 * (`cambiaJugador` con `nombres`); esto es la diapositiva suelta.
 */

import type { Player } from "@/types/player";
import type { GuionConsigna, SlidePizarra } from "@/lib/abp/pizarra";
import { enCaja, formasDe, nombreCorto, patron, sinTildes } from "@/lib/abp/textos-jugadores";

type Persona = { id: string; nombre?: string; apodo?: string };

const comoJugador = (p: Persona) => ({ nombre: p.nombre ?? "", apodo: p.apodo }) as Pick<Player, "nombre" | "apodo">;

/** La plantilla, en lista o por id (la pizarra la tiene por id). */
export type Plantilla = Persona[] | Map<string, Persona>;

const lista = (plantilla: Plantilla): Persona[] => (Array.isArray(plantilla) ? plantilla : [...plantilla.values()]);

export type Mencion = {
  desde: number;
  hasta: number;
  texto: string;
  playerId: string;
  /** «enlazada»: está en la lámina y cambia con su ficha; «fuera»: no está en esta lámina. */
  estado: "enlazada" | "fuera";
};

/** Por cada forma (sin tildes), de quién puede ser. */
function indiceDeFormas(plantilla: Persona[]) {
  const indice = new Map<string, Set<string>>();

  for (const player of plantilla) {
    for (const forma of formasDe(comoJugador(player))) {
      const clave = sinTildes(forma);
      const quienes = indice.get(clave) ?? new Set<string>();

      quienes.add(player.id);
      indice.set(clave, quienes);
    }
  }

  return indice;
}

const cacheExpresion = new WeakMap<object, { re: RegExp | null; indice: Map<string, Set<string>> }>();

function expresionDe(plantilla: Plantilla) {
  const hecha = cacheExpresion.get(plantilla);

  if (hecha) return hecha;

  const indice = indiceDeFormas(lista(plantilla));
  /* La más larga primero: «Álvaro Leiva» antes que «Leiva». */
  const formas = [...indice.keys()].sort((a, b) => b.length - a.length);
  const nueva = { re: formas.length ? new RegExp(formas.map(patron).join("|"), "giu") : null, indice };

  cacheExpresion.set(plantilla, nueva);

  return nueva;
}

/**
 * Los nombres de la plantilla que salen en un texto: a quién se refieren y si
 * están en la lámina (`enLamina`, los `playerId` de sus fichas y de nuestro
 * portero si se pinta). Lo ambiguo no sale.
 */
export function mencionesDe(texto: string, enLamina: Iterable<string>, plantilla: Plantilla): Mencion[] {
  const { re, indice } = expresionDe(plantilla);

  if (!texto || !re) return [];

  const presentes = new Set(enLamina);
  const salida: Mencion[] = [];

  re.lastIndex = 0;

  for (const m of texto.matchAll(re)) {
    const quienes = [...(indice.get(sinTildes(m[0])) ?? [])];
    const aqui = quienes.filter((id) => presentes.has(id));
    const desde = m.index ?? 0;

    if (aqui.length === 1) salida.push({ desde, hasta: desde + m[0].length, texto: m[0], playerId: aqui[0], estado: "enlazada" });
    else if (aqui.length === 0 && quienes.length === 1) salida.push({ desde, hasta: desde + m[0].length, texto: m[0], playerId: quienes[0], estado: "fuera" });
  }

  return salida;
}

/** Los jugadores que se pintan en la lámina (sus fichas y, si va, nuestro portero). */
export function enLaLamina(slide: Pick<SlidePizarra, "fichas">, portero?: string | null): Set<string> {
  return new Set([...slide.fichas.map((ficha) => ficha.playerId), ...(portero ? [portero] : [])]);
}

/* ------------------------------------------------------------------ */
/*  CAMBIAR LOS NOMBRES CUANDO CAMBIA LA FICHA                          */
/* ------------------------------------------------------------------ */

/** La clave de cada sitio de la lámina: su puesto o, si va suelta, la propia ficha. */
const sitioDe = (ficha: SlidePizarra["fichas"][number]) => (ficha.puesto ? `p:${ficha.puesto}` : `f:${ficha.id}`);

function ocupacion(slide: SlidePizarra) {
  const sitios = new Map<string, string>();

  for (const ficha of slide.fichas) sitios.set(sitioDe(ficha), ficha.playerId);

  return sitios;
}

/**
 * Quién pasa a ser quién en la diapositiva: el jugador que salía en unos
 * sitios y ahora en ellos sale otro, el mismo en todos. Si el que sale sigue
 * en la lámina en un sitio que no era de nadie que también cambia, no se sabe
 * de cuál de los dos hablaba la consigna: no se cambia.
 */
export function relevos(antes: SlidePizarra, despues: SlidePizarra): Map<string, string> {
  const a = ocupacion(antes);
  const d = ocupacion(despues);
  const destinos = new Map<string, Set<string | null>>();

  for (const [sitio, playerId] of a) {
    const set = destinos.get(playerId) ?? new Set<string | null>();

    set.add(d.get(sitio) ?? null);
    destinos.set(playerId, set);
  }

  let cambios = new Map<string, string>();

  for (const [sale, set] of destinos) {
    if (set.size !== 1) continue;

    const entra = [...set][0];

    if (entra && entra !== sale) cambios.set(sale, entra);
  }

  /* El que sale y sigue en la lámina: sólo vale si ocupa el sitio de otro que también cambia (un intercambio). */
  for (let vuelta = 0; vuelta < 4; vuelta += 1) {
    const siguen = new Map<string, string>();

    for (const [sale, entra] of cambios) {
      const dondeSigue = [...d].filter(([, playerId]) => playerId === sale).map(([sitio]) => sitio);
      const valido = dondeSigue.every((sitio) => {
        const habia = a.get(sitio);

        return habia != null && habia !== sale && cambios.get(habia) === sale;
      });

      if (valido) siguen.set(sale, entra);
    }

    if (siguen.size === cambios.size) break;

    cambios = siguen;
  }

  return cambios;
}

/** Cambia en un texto a cada uno por su relevo, todos a la vez (vale para un intercambio). */
export function cambiaNombres(texto: string, cambios: Map<string, string>, enLaminaAntes: Set<string>, plantilla: Plantilla): string {
  if (!texto || cambios.size === 0) return texto;

  const porId = new Map(lista(plantilla).map((p) => [p.id, p]));
  const menciones = mencionesDe(texto, enLaminaAntes, plantilla).filter((m) => m.estado === "enlazada" && cambios.has(m.playerId));

  if (menciones.length === 0) return texto;

  let salida = "";
  let desde = 0;

  for (const m of menciones) {
    const entra = porId.get(cambios.get(m.playerId) ?? "");

    if (!entra) continue;

    salida += texto.slice(desde, m.desde) + enCaja(m.texto, nombreCorto(comoJugador(entra)));
    desde = m.hasta;
  }

  return salida + texto.slice(desde);
}

const mismoGuion = (a?: GuionConsigna, b?: GuionConsigna) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * La diapositiva `despues` (lo que deja un cambio del analista sobre
 * `antes`) con las menciones de quien ha cambiado de ficha ya al día. Si el
 * cambio ya tocaba los textos (los escribía, restauraba una versión o traía
 * otra variante), se deja como venía: manda lo que se ha hecho a propósito.
 */
export function enlazaNombres(antes: SlidePizarra, despues: SlidePizarra, plantilla: Plantilla, portero?: string | null): SlidePizarra {
  if (antes === despues || antes.id !== despues.id) return despues;
  if (antes.notas.join("\n") !== despues.notas.join("\n") || !mismoGuion(antes.guion, despues.guion)) return despues;

  const cambios = relevos(antes, despues);

  if (cambios.size === 0) return despues;

  const estaban = enLaLamina(antes, portero);
  const cambia = (texto: string) => cambiaNombres(texto, cambios, estaban, plantilla);
  const notas = despues.notas.map(cambia);
  const guion = despues.guion
    ? (Object.fromEntries(Object.entries(despues.guion).map(([k, v]) => [k, typeof v === "string" ? cambia(v) : v])) as GuionConsigna)
    : undefined;

  const tocado = notas.some((nota, i) => nota !== despues.notas[i]) || !mismoGuion(guion, despues.guion);

  return tocado ? { ...despues, notas, ...(guion ? { guion } : {}) } : despues;
}
