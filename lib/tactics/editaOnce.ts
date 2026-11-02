/*
|--------------------------------------------------------------------------
| CAMBIAR NUESTRO ONCE SIN TOCAR LA FORMA DEL TABLERO (01/11/2026)
|--------------------------------------------------------------------------
|
| El tablero «Once 4-2-3-1» lo leen Emotion y la pizarra de ABP («Poner el
| once») por las fichas `home` y su NOMBRE (`onceDeLaPizarra`). Aquí no se
| inventa nada: cambiar a un titular sólo le cambia a SU FICHA el dorsal, el
| nombre, la foto y el puesto, en todas las escenas (como «Cambiar jugador»
| del campo). Las fichas no se mueven ni cambian de identificador: lo que el
| analista colocó a mano se queda donde está.
|
| QUÉ FICHA ES CADA HUECO. No basta con el identificador `once-home-<FICHA>`:
| el analista borra fichas y pone otras a mano (el tablero del Hércules tenía
| a Ciria, Pol, Óscar y Joan en fichas sueltas). Así que cada ficha nuestra va
| al hueco del 4-2-3-1 más cercano a donde está, todas a la vez (método
| húngaro), y el identificador sólo desempata.
*/

import { HUECOS, sitioDe, type Hueco } from "@/lib/data-analisis/once";
import type { Puesto } from "@/lib/data-analisis/individual";
import type { Player } from "@/types/player";

import { hungaro } from "./hungaro";
import { FICHA_DEL_HUECO, NUMERO_DEL_HUECO, escenasSinNumeroRepetido, huecoDeFicha, sitioDelHueco } from "./oncesSemana";
import type { TacticScene, TacticToken, TacticsDoc } from "./types";

export const clave = (nombre?: string) =>
  String(nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const nombreDeFicha = (p: Pick<Player, "nombre" | "apodo">) => p.apodo || p.nombre;

/** Lo que la ficha copia del jugador. */
const datosDe = (p: Player, label: string) => ({
  label: p.dorsal ? String(p.dorsal) : label,
  nombre: nombreDeFicha(p),
  foto: p.foto,
  posicion: p.posicion,
  alturaCm: undefined,
  pesoKg: undefined,
});

const copiaDatos = (de: TacticToken) => ({ label: de.label, nombre: de.nombre, foto: de.foto, posicion: de.posicion, alturaCm: de.alturaCm, pesoKg: de.pesoKg });

export type HuecoDelTablero = {
  hueco: Hueco;
  /** La ficha que lo ocupa; si no hay ninguna, la que se crearía. */
  tokenId: string;
  token: TacticToken | null;
  jugador: Player | null;
};

/** Cada ficha nuestra de la escena, en su hueco: por cercanía, todas a la vez. */
export function huecosDeFichas(escena: TacticScene | undefined): Map<string, string> {
  const fichas = (escena?.tokens ?? []).filter((t) => t.kind === "home");
  const salida = new Map<string, string>();

  if (!fichas.length) return salida;

  const coste = (t: TacticToken, h: Hueco) => {
    const s = sitioDelHueco(h.clave);
    const propio = huecoDeFicha(t.id) === h.clave ? -0.5 : 0;

    return Math.hypot(t.x - s.x, t.y - s.y) + propio;
  };

  if (fichas.length <= HUECOS.length) {
    hungaro(fichas.map((t) => HUECOS.map((h) => coste(t, h)))).forEach((j, i) => {
      if (j >= 0) salida.set(fichas[i].id, HUECOS[j].clave);
    });
  } else {
    /* Más de once nuestras (un comodín, un suplente pintado): los once más cercanos a algún hueco. */
    hungaro(HUECOS.map((h) => fichas.map((t) => coste(t, h)))).forEach((j, i) => {
      if (j >= 0) salida.set(fichas[j].id, HUECOS[i].clave);
    });
  }

  return salida;
}

const porNombreDe = (plantilla: Player[]) => {
  const mapa = new Map<string, Player>();

  for (const p of plantilla) {
    for (const n of [p.apodo, p.nombre]) {
      const k = clave(n);

      if (k && !mapa.has(k)) mapa.set(k, p);
    }
  }

  return mapa;
};

/** Los once huecos del tablero, con la ficha que los ocupa y su jugador de la plantilla. */
export function huecosDelTablero(escena: TacticScene | undefined, plantilla: Player[]): HuecoDelTablero[] {
  const tokens = escena?.tokens ?? [];
  const asignado = huecosDeFichas(escena);
  const porNombre = porNombreDe(plantilla);

  return HUECOS.map((hueco) => {
    const id = [...asignado.entries()].find(([, h]) => h === hueco.clave)?.[0];
    const token = id ? (tokens.find((t) => t.id === id) ?? null) : null;

    return {
      hueco,
      tokenId: token?.id ?? `once-home-${FICHA_DEL_HUECO[hueco.clave]}`,
      token,
      jugador: token?.nombre ? (porNombre.get(clave(token.nombre)) ?? null) : null,
    };
  });
}

/** Quién está en cada hueco (hueco → nombre de la ficha). */
export function onceDelTablero(escena: TacticScene | undefined): Record<string, string> {
  const salida: Record<string, string> = {};

  for (const h of huecosDelTablero(escena, [])) {
    const nombre = h.token?.nombre?.trim();

    if (nombre) salida[h.hueco.clave] = nombre;
  }

  return salida;
}

/** Si la ficha no está en la primera escena (un hueco vacío), se crea donde le toca. */
function conFicha(doc: TacticsDoc, tokenId: string, hueco: string): TacticsDoc {
  const [primera, ...resto] = doc.scenes;

  if (!primera || primera.tokens.some((t) => t.id === tokenId)) return doc;

  const nueva: TacticToken = { id: tokenId, kind: "home", label: NUMERO_DEL_HUECO[hueco] ?? "", ...sitioDelHueco(hueco) };

  return { ...doc, scenes: [{ ...primera, tokens: [...primera.tokens, nueva] }, ...resto] };
}

const sinRepetidos = (doc: TacticsDoc): TacticsDoc => {
  const arregladas = escenasSinNumeroRepetido(doc.scenes);

  return arregladas ? { ...doc, scenes: arregladas } : doc;
};

export type Sitio = { tokenId: string; hueco: string };

/**
 * Mete a un jugador en una ficha. Si ya estaba en otra ficha nuestra, los dos
 * se cambian el sitio: nadie sale dos veces.
 */
export function ponEnFicha(doc: TacticsDoc, sitio: Sitio, p: Player): TacticsDoc {
  const base = conFicha(doc, sitio.tokenId, sitio.hueco);
  const id = sitio.tokenId;
  const nombres = new Set([clave(nombreDeFicha(p)), clave(p.nombre)]);

  return sinRepetidos({
    ...base,
    scenes: base.scenes.map((s) => {
      const actual = s.tokens.find((t) => t.id === id);
      const otra = s.tokens.find((t) => t.kind === "home" && t.id !== id && nombres.has(clave(t.nombre)));

      return {
        ...s,
        tokens: s.tokens.map((t) => {
          if (t.id === id) return { ...t, ...datosDe(p, t.label) };
          if (otra && t.id === otra.id) return actual ? { ...t, ...copiaDatos(actual) } : { ...t, nombre: undefined, foto: undefined, posicion: undefined };

          return t;
        }),
      };
    }),
  });
}

/** Dos fichas nuestras se cambian el jugador (los sitios se quedan). */
export function intercambia(doc: TacticsDoc, a: Sitio, b: Sitio): TacticsDoc {
  if (a.tokenId === b.tokenId) return doc;

  const base = conFicha(conFicha(doc, a.tokenId, a.hueco), b.tokenId, b.hueco);

  return sinRepetidos({
    ...base,
    scenes: base.scenes.map((s) => {
      const ta = s.tokens.find((t) => t.id === a.tokenId);
      const tb = s.tokens.find((t) => t.id === b.tokenId);

      if (!ta || !tb) return s;

      return { ...s, tokens: s.tokens.map((t) => (t.id === ta.id ? { ...t, ...copiaDatos(tb) } : t.id === tb.id ? { ...t, ...copiaDatos(ta) } : t)) };
    }),
  });
}

/** Un once entero al tablero: cada hueco con su jugador, en la ficha que ocupa ese hueco. */
export function aplicaOnce(doc: TacticsDoc, once: { hueco: string; ficha: Player }[]): TacticsDoc {
  const huecos = huecosDelTablero(doc.scenes[0], []);
  const sitioDe = (hueco: string) => huecos.find((h) => h.hueco.clave === hueco)?.tokenId ?? `once-home-${FICHA_DEL_HUECO[hueco]}`;
  let base = doc;

  for (const { hueco } of once) base = conFicha(base, sitioDe(hueco), hueco);

  const porId = new Map(once.map((e) => [sitioDe(e.hueco), e.ficha]));
  const entran = new Set(once.flatMap((e) => [clave(nombreDeFicha(e.ficha)), clave(e.ficha.nombre)]));

  return sinRepetidos({
    ...base,
    scenes: base.scenes.map((s) => ({
      ...s,
      tokens: s.tokens.map((t) => {
        const p = porId.get(t.id);

        if (p) return { ...t, ...datosDe(p, t.label) };

        /* Otra ficha nuestra con alguien que ahora va en un hueco: se queda sin nombre, no duplicado. */
        if (t.kind === "home" && entran.has(clave(t.nombre))) return { ...t, nombre: undefined, foto: undefined, posicion: undefined };

        return t;
      }),
    })),
  });
}

/* ------------------------------------------------------------------ */
/*  LA LISTA DE CAMBIO: SU PUESTO PRIMERO                              */
/* ------------------------------------------------------------------ */

export type Lado = "D" | "I" | "C";

export const puestoDeFicha = (p: Pick<Player, "posicion">): { puesto: Puesto; lado: Lado } => {
  const s = sitioDe(String(p.posicion ?? ""), null);

  return { puesto: s.puesto, lado: s.lado };
};

/** El puesto que se busca para una ficha nuestra: el del hueco que ocupa en la escena. */
export function puestoBuscado(token: TacticToken, escena: TacticScene | undefined): { puesto: Puesto; lado: Lado; rotulo: string } | null {
  const h = huecosDeFichas(escena).get(token.id);
  const hueco = h ? HUECOS.find((x) => x.clave === h) : undefined;

  if (hueco) return { puesto: hueco.puesto, lado: hueco.lado, rotulo: hueco.rotulo.toLowerCase() };

  return token.posicion ? { ...puestoDeFicha({ posicion: token.posicion }), rotulo: "" } : null;
}

export const GRUPOS_CAMBIO = ["De su puesto", "En el campo: se cambian el sitio", "Resto de la plantilla", "No disponibles"] as const;

/** Orden de la lista de cambio: los de su puesto (y su lado) delante, los no disponibles al final. */
export function ordenaParaCambio<T extends { ficha: Player; enCampo: boolean }>(
  lista: T[],
  buscado: { puesto: Puesto; lado: Lado } | null,
  disponible: (p: Player) => boolean,
): (T & { grupo: string })[] {
  const nivel = (x: T) => {
    if (!disponible(x.ficha)) return 5;
    if (x.enCampo) return 3;

    const s = puestoDeFicha(x.ficha);

    if (buscado && s.puesto === buscado.puesto) return s.lado === buscado.lado || buscado.lado === "C" || s.lado === "C" ? 0 : 1;

    return 4;
  };

  const grupo = (n: number) => (n <= 1 ? GRUPOS_CAMBIO[0] : n === 3 ? GRUPOS_CAMBIO[1] : n === 4 ? GRUPOS_CAMBIO[2] : GRUPOS_CAMBIO[3]);

  return lista
    .map((x) => ({ x, n: nivel(x) }))
    .sort((a, b) => a.n - b.n || Number(b.x.ficha.esCastilla) - Number(a.x.ficha.esCastilla) || nombreDeFicha(a.x.ficha).localeCompare(nombreDeFicha(b.x.ficha), "es"))
    .map(({ x, n }) => ({ ...x, grupo: grupo(n) }));
}
