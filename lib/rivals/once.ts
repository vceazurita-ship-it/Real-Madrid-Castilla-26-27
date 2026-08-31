/*
|--------------------------------------------------------------------------
| ONCE TITULAR PROBABLE DEL RIVAL
|--------------------------------------------------------------------------
|
| Marcar quién sale de inicio y de quién se duda es trabajo de análisis, no un
| dato del club: cambia el jueves y otra vez el sábado por la mañana. No cabe
| en la hoja de Google —escribe por nombre de columna y no se pueden añadir
| columnas desde aquí— así que vive en `app_documents`, un documento por
| equipo, y se guarda solo.
|
| La clave del jugador **no** es su `ID_JUGADOR`: la hoja los renumera cuando
| se dan altas y bajas, y el once entero se descolocaría. Se usa la misma
| identidad que las estadísticas: el id de resfu escondido en la URL de la
| foto y, para las filas sin foto, equipo + nombre.
|
| El documento guarda además cómo se quiere ver el once en el PDF: qué dudas
| se pintan en el campo y dónde ha dejado el entrenador a cada uno. Eso se
| decide en el pop-up de antes de exportar (`components/rivals/OnceCampoDialog`)
| y se queda guardado, porque un once se retoca varias veces en la semana.
*/

import { slugClave } from "@/lib/rivals/media";
import { nameKey, resfuId } from "@/lib/rivals/stats";

export type OnceEstado = "titular" | "duda" | null;

/**
 * Sitio de un jugador en el campo, en tanto por uno del ancho y del alto.
 *
 * No se guarda en píxeles ni en puntos: el mismo sitio se pinta en el pop-up
 * —que mide lo que dé la pantalla— y en el campo del PDF, que mide 344 × 632
 * pt. En tanto por uno los dos leen lo mismo.
 */
export type OncePos = { x: number; y: number };

export interface RivalOnceDoc {
  /** Claves de jugador que salen de inicio. */
  titulares: string[];
  /** Claves de jugador en duda para el once. */
  dudas: string[];
  /**
   * Dudas que además se pintan en el campo. Un titular siempre sale en el
   * campo, así que aquí sólo hay dudas.
   */
  enCampo: string[];
  /**
   * Dónde ha dejado a cada uno el entrenador en el pop-up del PDF. Quien no
   * esté aquí se coloca solo, por líneas.
   */
  campo: Record<string, OncePos>;
}

export const ONCE_VACIO: RivalOnceDoc = {
  titulares: [],
  dudas: [],
  enCampo: [],
  campo: {},
};

export const RIVAL_ONCE_KIND = "rival-once";

/** Un once por equipo: la clave sale del nombre, que es lo estable aquí. */
export function rivalOnceKey(equipo: unknown): string {
  return `rival-once:${slugClave(equipo)}`;
}

/** Identidad estable de un jugador rival entre recargas de la hoja. */
export function playerKey(player: {
  FOTO?: unknown;
  NOMBRE_EQUIPO?: unknown;
  JUGADOR?: unknown;
}): string {
  const porFoto = resfuId(player.FOTO);

  if (porFoto) return `bs:${porFoto}`;

  return `nm:${nameKey(player.NOMBRE_EQUIPO, player.JUGADOR)}`;
}

/*
| Nombres de los parámetros con los que se puede llegar directo a una ficha.
| Los usan los PDF del once, que se leen en el móvil y tienen que poder abrir
| al jugador dentro de la app sin obligar a buscarlo a mano.
*/
export const PARAM_EQUIPO = "equipo";
export const PARAM_JUGADOR = "jugador";

/** Ruta que abre la app en la ficha de ese jugador. */
export function fichaRivalPath(equipo: string, clave: string): string {
  const params = new URLSearchParams({
    [PARAM_EQUIPO]: equipo,
    [PARAM_JUGADOR]: clave,
  });

  return `/rivals?${params.toString()}`;
}

/** 0 y 1 son el filo del campo: una cara puesta ahí se sale por la mitad. */
function dentro(valor: number): number {
  return Math.min(0.97, Math.max(0.03, valor));
}

export function normalizarOnce(data: unknown): RivalOnceDoc {
  const bruto = (data ?? {}) as Partial<RivalOnceDoc>;

  const lista = (valor: unknown): string[] =>
    Array.isArray(valor)
      ? valor.filter((item): item is string => typeof item === "string")
      : [];

  const titulares = lista(bruto.titulares);

  /* Un jugador no puede ser titular y duda a la vez; si el documento llega
     así (dos pestañas a la vez), manda titular. */
  const dudas = lista(bruto.dudas).filter((key) => !titulares.includes(key));

  /* Estar o no en el campo sólo lo decide una duda: el titular ya está. */
  const enCampo = lista(bruto.enCampo).filter((key) => dudas.includes(key));

  const campo: Record<string, OncePos> = {};

  Object.entries((bruto.campo ?? {}) as Record<string, unknown>).forEach(
    ([key, valor]) => {
      const pos = valor as Partial<OncePos> | null;

      if (!pos || typeof pos !== "object") return;
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

      /* Sólo se guarda el sitio de quien sigue en el once: si alguien sale,
         su marca no puede quedarse esperando a que vuelva a entrar. */
      if (!titulares.includes(key) && !dudas.includes(key)) return;

      campo[key] = { x: dentro(pos.x as number), y: dentro(pos.y as number) };
    }
  );

  return { titulares, dudas, enCampo, campo };
}

export function estadoDe(doc: RivalOnceDoc, key: string): OnceEstado {
  if (doc.titulares.includes(key)) return "titular";
  if (doc.dudas.includes(key)) return "duda";

  return null;
}

/** Sin balón que malinterpretar: titular → duda → fuera → titular. */
export function siguienteEstado(actual: OnceEstado): OnceEstado {
  if (actual === null) return "titular";
  if (actual === "titular") return "duda";

  return null;
}

export function conEstado(
  doc: RivalOnceDoc,
  key: string,
  estado: OnceEstado
): RivalOnceDoc {
  const titulares = doc.titulares.filter((item) => item !== key);
  const dudas = doc.dudas.filter((item) => item !== key);

  if (estado === "titular") titulares.push(key);
  if (estado === "duda") dudas.push(key);

  /* Quien sale del once se lleva su sitio puesto a mano: si vuelve a entrar
     el jueves que viene, entra por la puerta de siempre —su línea— y no donde
     se le dejó hace tres partidos. De titular a duda sí lo conserva: es el
     mismo jugador en el mismo sitio, sólo que ahora con interrogante. */
  const campo = { ...doc.campo };

  if (estado === null) delete campo[key];

  return {
    titulares,
    dudas,
    /* Un titular no está «metido en el campo»: está y punto. */
    enCampo: doc.enCampo.filter((item) => item !== key || estado === "duda"),
    campo,
  };
}

/** Deja a un jugador en un sitio concreto del campo; `null` se lo quita. */
export function conPosicion(
  doc: RivalOnceDoc,
  key: string,
  pos: OncePos | null
): RivalOnceDoc {
  const campo = { ...doc.campo };

  if (pos) campo[key] = { x: dentro(pos.x), y: dentro(pos.y) };
  else delete campo[key];

  return { ...doc, campo };
}

/** Mete o saca del campo a una duda. Sobre un titular no hace nada. */
export function conEnCampo(
  doc: RivalOnceDoc,
  key: string,
  meter: boolean
): RivalOnceDoc {
  if (!doc.dudas.includes(key)) return doc;

  const enCampo = doc.enCampo.filter((item) => item !== key);

  if (meter) enCampo.push(key);

  /* Al salir del campo pierde el sitio: si se vuelve a meter, se coloca con
     su línea, que es lo que se espera de alguien que acaba de entrar. */
  const campo = { ...doc.campo };

  if (!meter) delete campo[key];

  return { ...doc, enCampo, campo };
}

/**
 * Cambia a un jugador por otro sin deshacer el once.
 *
 * El que entra hereda lo del que sale: si era titular sale de titular, y si
 * era una duda pintada en el campo entra pintada y **en su mismo sitio**. Un
 * cambio de nombre no puede tirar por tierra la colocación que se acaba de
 * hacer a mano, que es justo lo que se estaba haciendo cuando se decide el
 * cambio.
 *
 * Si el que entra ya estaba marcado —era duda y resulta que sale de inicio—,
 * deja antes el hueco que ocupaba: nadie puede salir dos veces en el mismo
 * once.
 */
export function conSustitucion(
  doc: RivalOnceDoc,
  saliente: string,
  entrante: string
): RivalOnceDoc {
  if (!entrante || saliente === entrante) return doc;

  const estado = estadoDe(doc, saliente);

  /* Sólo se sustituye a quien está en el once: sin hueco que heredar esto
     sería un alta encubierta, y para dar altas está el campograma. */
  if (!estado) return doc;

  const sitio = doc.campo[saliente];
  const pintado = doc.enCampo.includes(saliente);

  /* Se vacían los dos huecos primero —el del que sale y el que el que entra
     pudiera tener ya— y sólo después se ocupa uno. */
  let siguiente = conEstado(conEstado(doc, entrante, null), saliente, null);

  siguiente = conEstado(siguiente, entrante, estado);

  if (estado === "duda" && pintado) {
    siguiente = conEnCampo(siguiente, entrante, true);
  }

  /* El sitio a mano sólo viaja si el que entra se va a pintar en el campo:
     una duda que se queda en la lista no tiene dónde estar. */
  if (sitio && (estado === "titular" || pintado)) {
    siguiente = conPosicion(siguiente, entrante, sitio);
  }

  return siguiente;
}

/** Devuelve el campo a la colocación automática, sin tocar quién está. */
export function sinPosiciones(doc: RivalOnceDoc): RivalOnceDoc {
  return { ...doc, campo: {} };
}

/** Quién se pinta en el campo: los titulares y las dudas que se han metido. */
export function seDibuja(doc: RivalOnceDoc, key: string): boolean {
  return doc.titulares.includes(key) || doc.enCampo.includes(key);
}

/** Cuántos hay marcados, para el contador del campograma. */
export function resumenOnce(doc: RivalOnceDoc) {
  return { titulares: doc.titulares.length, dudas: doc.dudas.length };
}

export const ONCE_COLOR: Record<"titular" | "duda", string> = {
  titular: "#34D399",
  duda: "#FBBF24",
};

export const ONCE_ETIQUETA: Record<"titular" | "duda", string> = {
  titular: "Titular",
  duda: "Duda",
};

/**
 * Deja puesto un once entero, con su colocación.
 *
 * Es lo que escribe el once sugerido (`lib/rivals/once-sugerido.ts`): once
 * claves y dónde va cada una. Se escribe **encima** de los titulares que
 * hubiera —proponer es empezar de nuevo— pero no se tocan las dudas que el
 * cuerpo técnico tenga marcadas, salvo las de quien pasa a ser titular: nadie
 * puede estar en las dos listas.
 *
 * Las dudas que estaban pintadas en el campo conservan su sitio; el resto de
 * marcas a mano se van con el once viejo, que es lo que se está sustituyendo.
 */
export function conOnce(
  doc: RivalOnceDoc,
  titulares: string[],
  campo: Record<string, OncePos>
): RivalOnceDoc {
  const nuevos = titulares.filter(
    (key, indice) => typeof key === "string" && titulares.indexOf(key) === indice
  );

  const dudas = doc.dudas.filter((key) => !nuevos.includes(key));

  const enCampo = doc.enCampo.filter((key) => dudas.includes(key));

  const sitios: Record<string, OncePos> = {};

  /* La duda que estaba pintada sigue donde estaba: no es lo que se propone. */
  for (const key of enCampo) {
    if (doc.campo[key]) sitios[key] = doc.campo[key];
  }

  for (const key of nuevos) {
    const pos = campo[key];

    if (pos) sitios[key] = { x: dentro(pos.x), y: dentro(pos.y) };
  }

  return { titulares: nuevos, dudas, enCampo, campo: sitios };
}
