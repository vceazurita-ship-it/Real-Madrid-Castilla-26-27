/**
 * EL PUESTO DE CADA JUGADOR RIVAL, UNO SOLO PARA TODAS LAS PANTALLAS
 * (16/11/2026, ronda 16 de los jueces).
 *
 * Jorquera salía de delantero en Plantillas y de extremo izquierdo en el Scout
 * colectivo y en Duelos; Olmedo, de lateral y de extremo. Cada pantalla leía el
 * puesto de un sitio (la hoja, Wyscout, el hueco de su once) y lo decía igual,
 * como si fuera lo mismo.
 *
 * Aquí se separan las dos cosas y se dicen las dos cuando no coinciden:
 * - **De origen**: el de la plantilla (columna POSICIÓN de la hoja RIVALES,
 *   con el rótulo de `lib/rivals/lineas-puesto.ts`). Es el que manda.
 * - **En su once**: el bloque del campograma en el que le coloca el once
 *   probable. Sale de `colocacionDelOnce`, que es **la misma cuenta del
 *   campograma de /rivals** (`reparteEnOnce` del motor, con la lectura de la
 *   temporada y lo puesto a mano en `rival-once:<slug>.puestos`, que manda).
 *
 *   puestoDelRival("DC", "ei") → { origen: "delantero", enElOnce: "extremo
 *   izquierdo", texto: "extremo izquierdo en su once (delantero de origen)" }
 *
 * `layoutPitch` (app/rivals/page.tsx) sigue siendo el adaptador de la pantalla
 * y no se ha tocado: el campograma no se mueve. Esta función repite su paso 1
 * (quién cae en qué bloque) con las mismas piezas del motor, sin geometría.
 */

import { ANCLAS_SLOT, asignaTitulares, DIBUJOS, DIBUJO_POR_DEFECTO, dibujoDeCampo, fueraDeSuHueco, reparteEnOnce, type BloqueOnce } from "@/lib/rivals/campograma-motor";
import { LINE_DEFINITIONS } from "@/lib/rivals/lineas-puesto";

const normaliza = (v: unknown) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const INDICE = LINE_DEFINITIONS.flatMap((line) =>
  line.slots.map((slot) => ({ slot, patrones: slot.match.map(normaliza).filter(Boolean) })),
);

/** El slot de la hoja: gana el patrón más largo que encaje (el mismo `getSlot` de /rivals). */
export function slotDeLaHoja(posicion: string): { key: string; label: string } | null {
  const valor = normaliza(posicion);

  if (!valor) return null;

  let mejor: (typeof INDICE)[number] | null = null;
  let largo = 0;

  for (const entrada of INDICE) {
    for (const patron of entrada.patrones) {
      if (patron.length > largo && valor.includes(patron)) {
        mejor = entrada;
        largo = patron.length;
      }
    }
  }

  return mejor ? { key: mejor.slot.key, label: mejor.slot.label } : null;
}

/* La hoja mezcla IZQUIERDO / IZQ / IZDO / I y DERECHO / DCHO / DER / D (como /rivals). */
const IZQUIERDA = /(^|[\s\-/(.])(izquierd[oa]|izq(da|do)?|izd[oa]?|zurd[oa]|i)([\s\-/).]|$)/;
const DERECHA = /(^|[\s\-/(.])(derech[oa]|dch[oa]|dcha|der|dr|d)([\s\-/).]|$)/;

export function ladoDeLaHoja(posicion: string): -1 | 0 | 1 {
  const valor = normaliza(posicion);

  if (IZQUIERDA.test(valor)) return -1;
  if (DERECHA.test(valor)) return 1;

  return 0;
}

export type JugadorAColocar = { clave: string; posicion: string };

/**
 * Quién cae en qué bloque del dibujo: clave del jugador → bloque.
 *
 * - `sitios`: lo que lleva jugado esta temporada (`leePosicionesDeLaTemporada`
 *   → `porJugador`), que manda sobre la hoja.
 * - `puestos`: lo puesto a mano en el campograma (`RivalOnceDoc.puestos`), que
 *   manda sobre todo.
 */
type OpcionesColocacion = {
  dibujo?: string | null;
  sitios?: Map<string, { slot: string; lado: -1 | 0 | 1 }>;
  puestos?: Record<string, string>;
  /** Los titulares del once probable: uno por hueco del dibujo (`asignaTitulares`), como el campograma. */
  titulares?: string[];
};

export function colocacionDelOnce(jugadores: JugadorAColocar[], opciones: OpcionesColocacion = {}): Map<string, BloqueOnce> {
  return colocaElOnce(jugadores, opciones).bloques;
}

/**
 * Lo mismo que `colocacionDelOnce` y, además, qué titulares han ido a un hueco
 * que no es el suyo (`fuera`, 18/11/2026): el once guardado se respeta entero
 * —11 titulares en 11 huecos— y el que no tiene hueco natural va al libre más
 * cercano a su zona. Las pantallas lo rotulan «fuera de su sitio».
 */
export function colocaElOnce(
  jugadores: JugadorAColocar[],
  opciones: OpcionesColocacion = {},
): { bloques: Map<string, BloqueOnce>; fuera: Set<string>; titulares: Map<string, BloqueOnce> } {
  const bloques = dibujoDeCampo(opciones.dibujo ?? undefined);
  const sitios = opciones.sitios ?? new Map();
  const puestos = opciones.puestos ?? {};

  const lee = (jugador: JugadorAColocar) => {
    const jugado = sitios.get(jugador.clave);

    if (jugado) return jugado;

    const slot = slotDeLaHoja(jugador.posicion)?.key ?? "otros";

    return { slot, lado: ANCLAS_SLOT[slot]?.xSide ? ladoDeLaHoja(jugador.posicion) : 0 };
  };

  const deTitulares = new Set(opciones.titulares ?? []);
  const asignados = new Map<string, string>();
  const fuera = new Set<string>();
  const titulares = new Map<string, BloqueOnce>();

  if (deTitulares.size > 0) {
    asignaTitulares(
      jugadores.filter((jugador) => deTitulares.has(jugador.clave)),
      lee,
      bloques,
      /* 11 en 11 (18/11/2026): el que no encaja, al hueco libre más cercano, «fuera de su sitio». */
      { fijado: (jugador) => puestos[jugador.clave], rellena: true },
    ).forEach((clave, jugador) => {
      asignados.set(jugador.clave, clave);

      const bloque = bloques.find((b) => b.key === clave);

      if (!bloque) return;

      titulares.set(jugador.clave, bloque);

      /* Lo puesto a mano no es «fuera de su sitio»: lo ha decidido alguien. */
      const { slot, lado } = lee(jugador);

      if (puestos[jugador.clave] !== clave && fueraDeSuHueco(bloque, slot, lado)) fuera.add(jugador.clave);
    });
  }

  /* El titular va a su hueco de `asignaTitulares` (manda sobre lo puesto a mano: ahí ya se ha respetado, sin repetir bloque). */
  const porBloque = reparteEnOnce(jugadores, lee, bloques, (jugador) => asignados.get(jugador.clave) ?? puestos[jugador.clave]);
  const salida = new Map<string, BloqueOnce>();

  for (const [clave, gente] of porBloque) {
    const bloque = bloques.find((b) => b.key === clave);

    if (!bloque) continue;

    for (const jugador of gente) salida.set(jugador.clave, bloque);
  }

  return { bloques: salida, fuera, titulares };
}

/*
| LAS LÍNEAS DEL DIBUJO (18/11/2026, jueces): «El once de un vistazo» ponía 5
| defensas y 2 medios bajo un 4-2-3-1 porque partía en líneas por la altura de
| cada hueco con umbrales fijos. Ahora las líneas salen del propio nombre del
| dibujo: en un 4-2-3-1, 4 defensas, 2 medios, 3 por detrás del punta y 1
| delantero; en un 4-3-3, 4, 3 y 3. Los huecos se ordenan de atrás adelante
| por su ancla y se cortan con esos números: las mismas filas del campograma.
*/
export type LineaDelDibujo = {
  clave: string;
  titulo: string;
  /** La línea de LINE_DEFINITIONS de la que toma el color. */
  color: "portero" | "defensa" | "medio" | "ataque";
  /** Claves de bloque, de izquierda a derecha. */
  bloques: string[];
};

/**
 * El dibujo al que pertenecen unas claves de bloque (las de un once ya
 * colocado): el que las tiene todas y le sobran menos. Sirve a quien sólo
 * recibe la colocación (Scout individual) para sacar las mismas líneas.
 */
export function dibujoDeLasClaves(claves: Iterable<string>): string {
  const lista = [...new Set(claves)].filter(Boolean);
  let mejor = DIBUJO_POR_DEFECTO;
  let nota = -Infinity;

  for (const dibujo of DIBUJOS) {
    const suyas = new Set(dibujo.bloques.map((b) => b.key));
    const dentro = lista.filter((k) => suyas.has(k)).length;
    const valor = dentro * 10 - (lista.length - dentro) * 100 - (suyas.size - dentro);

    if (valor > nota) {
      nota = valor;
      mejor = dibujo.id;
    }
  }

  return mejor;
}

export function lineasDelDibujo(dibujo: string | null | undefined): LineaDelDibujo[] {
  const bloques = dibujoDeCampo(dibujo ?? undefined);
  const id = DIBUJOS.some((d) => d.id === dibujo) ? String(dibujo) : DIBUJO_POR_DEFECTO;
  const cortes = id.split("-").map(Number);
  const campo = bloques.filter((b) => b.key !== "por").sort((a, b) => b.anchorY - a.anchorY);
  const salida: LineaDelDibujo[] = [{ clave: "portero", titulo: "Portería", color: "portero", bloques: ["por"] }];
  let desde = 0;

  cortes.forEach((n, i) => {
    const fila = campo.slice(desde, desde + n).sort((a, b) => a.anchorX - b.anchorX);
    desde += n;

    const ultima = i === cortes.length - 1;
    const titulo =
      i === 0
        ? "Defensa"
        : ultima
          ? n === 1
            ? "Delantero"
            : "Ataque"
          : cortes.length === 4 && i === 2
            ? cortes[1] === 1
              ? "Medio y bandas"
              : "Mediapunta y bandas"
            : n === 1
              ? "Pivote"
              : "Medio";

    salida.push({
      clave: `l${i}`,
      titulo,
      color: i === 0 ? "defensa" : ultima || (cortes.length === 4 && i === 2 && cortes[1] !== 1) ? "ataque" : "medio",
      bloques: fila.map((b) => b.key),
    });
  });

  return salida;
}

const PUESTO_DEL_CODIGO: Record<string, string> = {
  POR: "portero",
  LD: "lateral derecho",
  LI: "lateral izquierdo",
  DFC: "central",
  MCD: "pivote",
  /* 18/11/2026: el MC de un 4-2-3-1 o un 4-4-2 es el doble pivote. «Mediocentro» en /rivals y «pivote» en Scout individual para el mismo hueco (Palmberg) era el mismo dato dicho de dos formas. */
  MC: "pivote",
  INT: "interior",
  MP: "mediapunta",
  ED: "extremo derecho",
  EI: "extremo izquierdo",
  DC: "delantero",
  CAR: "carrilero",
};

/* Los medios por banda de un 4-4-2 («mi», «md») se pintan como extremos. */
const POR_CLAVE_BANDA: Record<string, string> = { mi: "EI", md: "ED" };

/** «ei» / BloqueOnce → «extremo izquierdo»; el carrilero y el interior, con su lado. */
export function puestoDelBloque(bloque: BloqueOnce | string | null | undefined): string {
  if (!bloque) return "";

  const b = typeof bloque === "string" ? null : bloque;
  const clave = typeof bloque === "string" ? bloque : bloque.key;
  /* Con sólo la clave: primero entera («mcd» = pivote, «ei»), luego sin el lado («dfci» → DFC). */
  const entera = clave.toUpperCase();
  const codigo = b?.code ?? (PUESTO_DEL_CODIGO[entera] ? entera : POR_CLAVE_BANDA[clave] ?? entera.replace(/[ID]$/, ""));
  const base = PUESTO_DEL_CODIGO[codigo] ?? "";
  const lado = b?.lado ?? (/i$/.test(clave) ? -1 : /d$/.test(clave) ? 1 : 0);

  if ((codigo === "CAR" || codigo === "INT") && lado !== 0) return `${base} ${lado < 0 ? "izquierdo" : "derecho"}`;

  return base;
}

/** Dos puestos dicen lo mismo si son la misma palabra o uno es el genérico del otro. */
function mismoPuesto(a: string, b: string) {
  if (!a || !b) return true;
  if (a === b) return true;

  return a.startsWith(b) || b.startsWith(a) || (a === "mediocentro" && b === "pivote") || (a === "pivote" && b === "mediocentro");
}

export type PuestoDelRival = {
  /** El de la plantilla, en minúsculas: «delantero». */
  origen: string;
  /** Dónde le pone su once, si es otro sitio: «extremo izquierdo». */
  enElOnce: string | null;
  /** «extremo izquierdo en su once (delantero de origen)» o «delantero». */
  texto: string;
};

/**
 * El puesto de un jugador rival para pintarlo en cualquier pantalla.
 *
 * `posicion` es la columna POSICIÓN de la hoja; `once`, el bloque en el que le
 * coloca `colocacionDelOnce` (o su clave). Sin hoja, el del once a secas.
 */
export function puestoDelRival(posicion: string, once?: BloqueOnce | string | null): PuestoDelRival {
  const origen = (slotDeLaHoja(posicion)?.label ?? String(posicion ?? "").trim()).toLowerCase();
  const enOnce = puestoDelBloque(once ?? null);

  if (!origen) return { origen: "", enElOnce: enOnce || null, texto: enOnce };
  if (!enOnce || mismoPuesto(origen, enOnce)) return { origen, enElOnce: null, texto: origen };

  return { origen, enElOnce: enOnce, texto: `${enOnce} en su once (${origen} de origen)` };
}
