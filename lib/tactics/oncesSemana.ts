/*
|--------------------------------------------------------------------------
| LOS ONCES DE LA SEMANA, PARA LA PIZARRA TÁCTICA (13/10/2026)
|--------------------------------------------------------------------------
|
| El tablero de los onces se rellena solo cada semana con:
|   - NUESTRO ÚLTIMO ONCE: los titulares del último partido jugado según
|     Valoraciones (`/api/ratings/load`, `starter`), colocados en 4-2-3-1 por
|     su puesto de la plantilla con `proponeOnce` (el mismo reparto que
|     Duelos y el once de DATA);
|   - SU ONCE TEÓRICO: lo cambiado a mano en Duelos (`duelos:<rival>`) manda;
|     si no, el once probable marcado en Plantillas rivales
|     (`rival-once:<rival>`); si no, su último once de BeSoccer
|     (`rivals:informe`); si no, los de su plantilla por puesto.
|
| Se lee sólo en el navegador y sólo cuando cambia la semana: el informe de
| BeSoccer pesa y únicamente se pide si el rival no tiene once marcado.
*/

import { cargaCalendario } from "@/hooks/useCalendario";
import { alrededorDe, soloDia } from "@/lib/castilla/calendario";
import { HUECOS, casaNombre, proponeOnce, sitioDe } from "@/lib/data-analisis/once";
import { formations } from "@/lib/formations";
import { traeJson } from "@/lib/hojaCsv";
import { findInforme, type InformeDoc } from "@/lib/rivals/informe";
import { slugClave } from "@/lib/rivals/media";
import { bajaDe, estaFuera } from "@/lib/rivals/bajas";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizarOnce, playerKey, rivalOnceKey } from "@/lib/rivals/once";
import type { RatingsSeason } from "@/lib/ratings/types";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { baseSuyaDe, onceNuestroDe, onceSuyoDe, nuestrosDe, suyosDe } from "@/lib/duelos-onces";
import { normalizaDuelos, type JugadorDuelo } from "@/lib/duelos";
import type { Player } from "@/types/player";

import { DIBUJO_DE_PARTIDA, numerosDelOnce } from "./dosOnces";
import { fuenteUltimoOnce, huecosDelUltimoOnce } from "./ultimoOnce";
import { rivalTokenId } from "./rivals";
import { PITCH_HEIGHT, type TacticToken } from "./types";

type Fila = Record<string, unknown>;

const texto = (v: unknown) => String(v ?? "").trim();

/** El hueco de `proponeOnce` → la ficha del 4-2-3-1 de `lib/formations` (nosotros atacando a la derecha). */
export const FICHA_DEL_HUECO: Record<string, string> = {
  por: "POR",
  "lat-i": "LI",
  "cen-i": "DFC1",
  "cen-d": "DFC2",
  "lat-d": "LD",
  "piv-i": "MCD1",
  "piv-d": "MCD2",
  "ban-i": "MI",
  media: "DC2",
  "ban-d": "MD",
  del: "DC1",
};

/** «once-home-MCD1» → «piv-i»: el hueco de una ficha nuestra del tablero de los onces. */
export const huecoDeFicha = (tokenId: string): string | null => {
  const ficha = tokenId.startsWith("once-home-") ? tokenId.slice("once-home-".length) : "";

  return Object.entries(FICHA_DEL_HUECO).find(([, f]) => f === ficha)?.[0] ?? null;
};

/** El número de la camiseta de cada hueco, como en `dosOnces`. */
export const NUMERO_DEL_HUECO: Record<string, string> = { por: "1", "lat-d": "2", "lat-i": "3", "cen-d": "4", "cen-i": "5", "piv-d": "6", "piv-i": "8", "ban-d": "7", media: "10", "ban-i": "11", del: "9" };

/* Igual que `dosOnces`: cada equipo comprimido en su mitad. */
const comprime = (porcentaje: number) => 10 + ((porcentaje - 12) / (87 - 12)) * 35;

function sitioDeFicha(ficha: string) {
  const puesto = (formations[DIBUJO_DE_PARTIDA] ?? []).find((p) => p.id === ficha);

  return puesto ? { x: comprime(Number.parseFloat(puesto.left)), y: (Number.parseFloat(puesto.top) / 100) * PITCH_HEIGHT } : { x: 30, y: PITCH_HEIGHT / 2 };
}

/** Dónde cae cada hueco en el tablero, para nuestro equipo (el rival, media vuelta). */
export const sitioDelHueco = (clave: string) => sitioDeFicha(FICHA_DEL_HUECO[clave] ?? "");

export type OncesSemana = {
  /** «2026-10-18|UD Ibiza»: con esto se sabe si el tablero ya es de esta semana. */
  semana: string;
  rival: string;
  tokens: TacticToken[];
  /** De dónde sale cada once, para decirlo en pantalla. */
  fuenteNuestra: string;
  fuenteSuya: string;
};

async function leeDoc<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    const j = (await r.json()) as { data?: T | null };

    return j?.data ?? null;
  } catch {
    return null;
  }
}

/*
| EL MOTOR VA EN LA MARCA DE LA SEMANA (29/10/2026)
|
| El tablero sólo se rellena solo cuando cambia `semanaOnces`. Al pasar al
| motor de /duelos, el tablero de esta semana ya estaba rellenado con la regla
| vieja (diez fichas con nombre, Martínez y Ramírez en vez de Corral y
| Ribeiro) y no se volvía a tocar hasta la semana siguiente: el cuerpo técnico
| seguía viendo el once que no era. Con el motor dentro de la marca, cada
| cambio de motor rellena una vez (con «Deshacer» a mano). Los lectores que
| parten la marca por «|» siguen leyendo día y rival en [0] y [1].
*/
const MOTOR_ONCES = "duelos";

/** La semana del próximo partido, sin cargar nada más: para saber si hay que rellenar. */
export async function semanaActual(): Promise<{ semana: string; rival: string; fecha: string; lado: "casa" | "fuera"; anteriorCuando: string | null } | null> {
  const partidos = await cargaCalendario();
  const { proximo, anterior } = alrededorDe(partidos, Date.now());

  return proximo
    ? { semana: `${soloDia(proximo.cuando)}|${proximo.rival}|${MOTOR_ONCES}`, rival: proximo.rival, fecha: soloDia(proximo.cuando), lado: proximo.lado, anteriorCuando: anterior?.cuando ?? null }
    : null;
}

/**
 * Un tablero de onces al que le falta gente: menos de once fichas con nombre
 * en algún equipo (29/10/2026). No se da por bueno: al abrirlo se rellena otra
 * vez, aunque la semana sea la misma.
 */
export function onceIncompleto(tokens: TacticToken[] | undefined): boolean {
  const lista = tokens ?? [];
  const conNombre = (kind: "home" | "away") => lista.filter((t) => t.kind === kind && texto(t.nombre)).length;

  return conNombre("home") < 11 || conNombre("away") < 11;
}

/* ------------------------------------------------------------------ */
/*  NUESTRO ÚLTIMO ONCE                                                */
/* ------------------------------------------------------------------ */


function nuestroUltimoOnce(temporada: RatingsSeason | null, plantilla: Player[], aMano: Record<string, string> = {}) {
  const reparto = huecosDelUltimoOnce(temporada, plantilla, aMano);
  const { huecos, porId } = reparto;

  const tokens: TacticToken[] = HUECOS.flatMap((h) => {
    const p = porId.get(huecos[h.clave]);
    const ficha = FICHA_DEL_HUECO[h.clave];

    if (!ficha) return [];

    const sitio = sitioDeFicha(ficha);

    return [
      {
        id: `once-home-${ficha}`,
        kind: "home" as const,
        label: p?.dorsal ? String(p.dorsal) : NUMERO_DEL_HUECO[h.clave],
        nombre: p ? p.apodo || p.nombre : undefined,
        foto: p?.foto,
        posicion: p?.posicion,
        ...sitio,
      },
    ];
  });

  return { tokens, fuente: `${fuenteUltimoOnce(reparto)}${Object.keys(aMano).length ? ", con lo cambiado en Duelos" : ""}` };
}

/* ------------------------------------------------------------------ */
/*  SU ONCE TEÓRICO                                                    */
/* ------------------------------------------------------------------ */

export async function suOnceTeorico(rival: string) {
  const filas = await traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas").catch(() => [] as Fila[]);
  const suyas = (Array.isArray(filas) ? filas : []).filter((f) => mismoClub(texto(f.NOMBRE_EQUIPO), rival));
  const equipo = texto(suyas[0]?.NOMBRE_EQUIPO) || rival;

  const jugadores = suyas.map((f) => {
    const nombre = texto(f["NOMBRE DEPORTIVO"]) || texto(f.JUGADOR) || "Sin nombre";
    const foto = texto(f.FOTO);

    return {
      clave: playerKey(f as never),
      tokenId: rivalTokenId(texto(f.ID_JUGADOR) || `${equipo}-${nombre}`),
      nombre,
      dorsal: texto(f.DORSAL),
      foto: foto && foto !== "." ? foto : undefined,
      posicion: texto(f["POSICIÓN"]) || texto(f["2º POSICIÓN"]),
      sitio: sitioDe(texto(f["POSICIÓN"]), null),
      fuera: estaFuera(f),
    };
  });

  const [duelos, onceDoc] = await Promise.all([leeDoc<{ suyo?: Record<string, string>; nuestro?: Record<string, string> }>(`duelos:${slugClave(equipo)}`), leeDoc<unknown>(rivalOnceKey(equipo))]);

  /* La base: el once marcado; si no, su último once de BeSoccer. */
  let base = normalizarOnce(onceDoc).titulares;
  let fuente = "Once probable marcado en Plantillas rivales";

  if (base.length < 7) {
    const informe = findInforme(await leeDoc<InformeDoc>("rivals:informe"), equipo);
    const ultimo = informe?.onces?.find((o) => o.jugadores.length > 0);
    const deBeSoccer = (ultimo?.jugadores ?? []).map((u) => casaNombre(u.nombre, jugadores, (j) => j.nombre)?.clave).filter((k): k is string => Boolean(k));

    if (deBeSoccer.length >= 7) {
      base = deBeSoccer;
      fuente = `Su último once en BeSoccer${ultimo?.estructura ? ` (${ultimo.estructura})` : ""}`;
    } else {
      base = [];
      fuente = "Sin once marcado ni alineaciones: su plantilla por puesto";
    }
  }

  const enBase = new Set(base);
  const aMano = Object.fromEntries(Object.entries(duelos?.suyo ?? {}).filter(([, c]) => c && c !== "∅"));

  if (Object.keys(aMano).length) fuente = `${fuente}, con lo cambiado en Duelos`;

  const huecos = proponeOnce(
    jugadores.map((j) => ({ id: j.clave, sitio: j.sitio, minutos: j.fuera ? -10_000 : enBase.has(j.clave) ? 10_000 : 0 })),
    aMano,
  );

  const porClave = new Map(jugadores.map((j) => [j.clave, j]));

  /* Media vuelta entera, como en `dosOnces`: su izquierda es nuestra derecha. */
  const tokens: TacticToken[] = HUECOS.flatMap((h) => {
    const ficha = FICHA_DEL_HUECO[h.clave];
    const j = porClave.get(huecos[h.clave]);

    if (!ficha) return [];

    const sitio = sitioDeFicha(ficha);

    return [
      {
        id: j ? j.tokenId : `once-away-${ficha}`,
        kind: "away" as const,
        label: j?.dorsal || NUMERO_DEL_HUECO[h.clave],
        nombre: j?.nombre,
        foto: j?.foto,
        posicion: j?.posicion,
        x: 100 - sitio.x,
        y: PITCH_HEIGHT - sitio.y,
      },
    ];
  });

  return { tokens, fuente, equipo, nuestroAMano: duelos?.nuestro ?? {} };
}

/**
 * Los veintidós de la semana, con el MISMO motor que /duelos (29/10/2026).
 *
 * El cuerpo técnico no puede proyectar un once distinto del que se analiza:
 * antes la pizarra armaba el suyo con otra regla y salían diez fichas, o
 * titulares que /duelos y /rivals no ponían. Aquí se llama a las mismas
 * funciones de `lib/duelos-onces`. Si Wyscout no contesta, queda la vía
 * anterior (`oncesPorLaVieja`).
 */
export async function oncesDeLaSemana(plantilla: Player[]): Promise<OncesSemana | null> {
  const semana = await semanaActual();

  if (!semana) return null;

  const [datos, filas, informeDoc, temporada] = await Promise.all([
    traeJson<{ ok?: boolean; jugadores?: FilaJugador[] }>("/api/data-analisis").catch(() => null),
    traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas").catch(() => [] as Fila[]),
    leeDoc<InformeDoc>("rivals:informe"),
    traeJson<{ success?: boolean; season?: RatingsSeason }>("/api/ratings/load")
      .then((r) => (r?.success ? r.season ?? null : null))
      .catch(() => null),
  ]);

  const jugadores = datos?.jugadores ?? [];
  const hoja = Array.isArray(filas) ? filas : [];
  const equipo = texto(hoja.find((f) => mismoClub(texto(f.NOMBRE_EQUIPO), semana.rival))?.NOMBRE_EQUIPO) || semana.rival;

  /* Sin Wyscout no hay forma de repartir igual que Duelos: la vía anterior. */
  if (jugadores.length === 0 || !hoja.some((f) => texto(f.NOMBRE_EQUIPO) === equipo)) return oncesPorLaVieja(plantilla, semana, temporada);

  const [onceDoc, duelosDoc] = await Promise.all([
    leeDoc<unknown>(rivalOnceKey(equipo)),
    leeDoc<unknown>(`duelos:${slugClave(equipo)}`),
  ]);
  const aMano = normalizaDuelos(duelosDoc);

  const nuestros = nuestrosDe(jugadores, plantilla);
  const suyos = suyosDe(hoja, equipo, jugadores);
  const baseSuya = baseSuyaDe(suyos, normalizarOnce(onceDoc).titulares, findInforme(informeDoc, equipo));
  const reparto = huecosDelUltimoOnce(temporada, plantilla);
  const baseNuestra = reparto.ultimo ? Object.fromEntries(Object.entries(reparto.huecos).filter(([, id]) => id)) : null;

  const onceNuestro = onceNuestroDe(nuestros, aMano.nuestro, baseNuestra, plantilla);
  const onceSuyo = onceSuyoDe(suyos, baseSuya.lista, aMano.suyo);

  const fichaDe = new Map(plantilla.map((p) => [p.id, p]));
  const idHoja = new Map(hoja.map((f) => [playerKey(f as never), texto(f.ID_JUGADOR)]));

  const tokens: TacticToken[] = HUECOS.flatMap((h) => {
    const ficha = FICHA_DEL_HUECO[h.clave];
    const nuestro: JugadorDuelo | undefined = onceNuestro[h.clave];
    const suyo: JugadorDuelo | undefined = onceSuyo[h.clave];

    if (!ficha) return [];

    const sitio = sitioDeFicha(ficha);
    /*
    | El dorsal sale siempre de la ficha (10/11/2026, jueces): sin `fichaId`
    | (cruzado sólo por Wyscout) caía el número del hueco y Carvajal salía con
    | el 9 en el campo y con el 19 en la lista. Se busca la ficha por nombre.
    */
    const p =
      (nuestro?.fichaId ? fichaDe.get(nuestro.fichaId) : undefined) ??
      (nuestro ? (casaNombre(nuestro.nombre, plantilla, (f) => f.apodo || f.nombre) ?? casaNombre(nuestro.nombre, plantilla, (f) => f.nombre) ?? undefined) : undefined);

    return [
      {
        id: `once-home-${ficha}`,
        kind: "home" as const,
        label: p?.dorsal ? String(p.dorsal) : NUMERO_DEL_HUECO[h.clave],
        nombre: p ? p.apodo || p.nombre : nuestro?.nombre,
        foto: p?.foto ?? nuestro?.foto,
        posicion: p?.posicion ?? nuestro?.posicion,
        ...sitio,
      },
      {
        id: suyo ? rivalTokenId(idHoja.get(suyo.clave) || `${equipo}-${suyo.nombre}`) : `once-away-${ficha}`,
        kind: "away" as const,
        label: suyo?.dorsal || NUMERO_DEL_HUECO[h.clave],
        nombre: suyo?.nombre,
        foto: suyo?.foto,
        posicion: suyo?.posicion,
        x: 100 - sitio.x,
        y: PITCH_HEIGHT - sitio.y,
      },
    ];
  });

  return {
    semana: semana.semana,
    rival: equipo,
    tokens: [...sinNumeroRepetido(tokens.filter((t) => t.kind === "home")), ...sinNumeroRepetido(tokens.filter((t) => t.kind === "away"))],
    fuenteNuestra: `${fuenteUltimoOnce(reparto)}${Object.keys(aMano.nuestro).length ? ", con lo cambiado en Duelos" : ""}`,
    fuenteSuya: `${baseSuya.fuente}${Object.keys(aMano.suyo).length ? ", con lo cambiado en Duelos" : ""}`,
  };
}

/**
 * Las fichas (id de token) de su once marcado en Plantillas rivales y de lo
 * puesto a mano en Duelos (07/11/2026): con ellas la pizarra sabe si su once
 * ha cambiado después de rellenar el tablero. `null` sin once marcado.
 */
export async function fichasDeSuOnceMarcado(rival: string): Promise<Set<string> | null> {
  const filas = await traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas").catch(() => [] as Fila[]);
  const hoja = (Array.isArray(filas) ? filas : []).filter((f) => mismoClub(texto(f.NOMBRE_EQUIPO), rival));
  const equipo = texto(hoja[0]?.NOMBRE_EQUIPO) || rival;
  const [onceDoc, duelosDoc] = await Promise.all([leeDoc<unknown>(rivalOnceKey(equipo)), leeDoc<unknown>(`duelos:${slugClave(equipo)}`)]);
  const marcadosTodos = normalizarOnce(onceDoc).titulares;

  if (marcadosTodos.length < 7) return null;

  /* Los de baja no cuentan: el motor los deja fuera y el aviso no se iría nunca (08/11/2026). */
  const deBaja = new Set(hoja.filter(estaFuera).map((f) => playerKey(f as never)));
  const marcados = marcadosTodos.filter((k) => !deBaja.has(k));

  const aMano = Object.values(normalizaDuelos(duelosDoc).suyo).filter((c) => c && c !== "∅");
  const porClave = new Map(hoja.map((f) => [playerKey(f as never), f]));
  const ids = new Set<string>();

  for (const clave of new Set([...marcados, ...aMano])) {
    const f = porClave.get(clave);

    if (f) ids.add(rivalTokenId(texto(f.ID_JUGADOR) || `${equipo}-${texto(f["NOMBRE DEPORTIVO"]) || texto(f.JUGADOR)}`));
  }

  return ids;
}

/**
 * Los rivales de baja, por id de ficha del tablero (08/11/2026, fútbol): la
 * pizarra avisa si alguno sigue colocado. Lesionado, sancionado o tocado
 * (duda), según el estado de la hoja o las etiquetas de su ficha.
 */
export async function bajasDelRival(rival: string): Promise<Map<string, { nombre: string; baja: string }>> {
  const filas = await traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas").catch(() => [] as Fila[]);
  const hoja = (Array.isArray(filas) ? filas : []).filter((f) => mismoClub(texto(f.NOMBRE_EQUIPO), rival));
  const equipo = texto(hoja[0]?.NOMBRE_EQUIPO) || rival;
  const salida = new Map<string, { nombre: string; baja: string }>();

  for (const f of hoja) {
    const baja = bajaDe(f);
    const nombre = texto(f["NOMBRE DEPORTIVO"]) || texto(f.JUGADOR);

    if (baja) salida.set(rivalTokenId(texto(f.ID_JUGADOR) || `${equipo}-${nombre}`), { nombre, baja });
  }

  return salida;
}

/*
| ¿TABLERO SIN TOCAR? (08/11/2026)
|
| Los jueces vieron el tablero con el once viejo del rival (Yago Cantero,
| lesionado) y un aviso «Actualizar» que nadie pulsaba. Si nadie ha tocado el
| tablero desde que se rellenó, se actualiza solo. Para saberlo, la escena del
| relleno lleva en su id la huella de sus fichas: si la huella sigue siendo la
| misma, nadie ha movido, cambiado ni dibujado nada.
*/
export function huellaFichas(tokens: TacticToken[]): string {
  const cadena = [...tokens]
    .map((t) => `${t.id}:${t.label}:${t.nombre ?? ""}:${Math.round(t.x * 10)}:${Math.round(t.y * 10)}`)
    .sort()
    .join("|");
  let h = 5381;

  for (let i = 0; i < cadena.length; i++) h = ((h * 33) ^ cadena.charCodeAt(i)) >>> 0;

  return h.toString(36);
}

export const idEscenaOnces = (tokens: TacticToken[]) => `onces-auto-${huellaFichas(tokens)}`;

export function tableroSinTocar(escenas: { id: string; tokens: TacticToken[]; shapes: unknown[] }[]): boolean {
  if (escenas.length !== 1) return false;

  const [escena] = escenas;

  if (escena.shapes.length > 0) return false;

  if (escena.id.startsWith("onces-auto-")) return escena.id === idEscenaOnces(escena.tokens);

  /* Rellenado antes del 08/11/2026 (sin huella): NUNCA se da por no tocado.
     Cambiar un jugador (pinchar la ficha, «Para entrar») cambia el nombre y
     no el sitio, así que «cada ficha en su hueco» no prueba nada y la
     autoactualización pisaba esos cambios. Para estos tableros sólo sale el
     aviso «Actualizar», que decide el analista. */
  return false;
}

/** La vía anterior, sólo si Wyscout o las plantillas no contestan. */
async function oncesPorLaVieja(plantilla: Player[], semana: { semana: string; rival: string }, temporada: RatingsSeason | null): Promise<OncesSemana> {
  const suyo = await suOnceTeorico(semana.rival);
  const nuestro = nuestroUltimoOnce(temporada, plantilla, suyo.nuestroAMano);

  return {
    semana: semana.semana,
    rival: suyo.equipo,
    tokens: [...sinNumeroRepetido(nuestro.tokens), ...sinNumeroRepetido(suyo.tokens)],
    fuenteNuestra: nuestro.fuente,
    fuenteSuya: suyo.fuente,
  };
}

/*
| DOS «6» EN EL MISMO ONCE (21/10/2026)
|
| La hoja trae en DORSAL el número del puesto, no el de la camiseta (ver
| `dorsales-plantilla-y-rivales`): los dos mediocentros salían con un 6 y en
| la charla se leía como un dorsal repetido. Si dos del mismo equipo llevan el
| mismo número, el que no está en su hueco natural se queda con el del hueco
| (el doble pivote, 6 y 8) o, si ya está cogido, con el más bajo libre.
*/
export function sinNumeroRepetido(tokens: TacticToken[]): TacticToken[] {
  const delHueco = numerosDelOnce(DIBUJO_DE_PARTIDA);
  const huecoDe = (token: TacticToken) => delHueco[token.id];

  const cuenta = new Map<string, number>();

  for (const token of tokens) cuenta.set(token.label, (cuenta.get(token.label) ?? 0) + 1);

  if ([...cuenta.values()].every((veces) => veces < 2)) return tokens;

  const usados = new Set(tokens.map((token) => token.label));
  const visto = new Set<string>();

  /* Primero se queda el número quien lo tiene por su hueco. */
  for (const token of tokens) if ((cuenta.get(token.label) ?? 0) > 1 && huecoDe(token) === token.label) visto.add(token.label);

  return tokens.map((token) => {
    if ((cuenta.get(token.label) ?? 0) < 2) return token;

    if (!visto.has(token.label)) {
      visto.add(token.label);

      return token;
    }

    if (huecoDe(token) === token.label) return token;

    let numero = huecoDe(token);

    if (!numero || usados.has(numero)) {
      let libre = 1;

      while (usados.has(String(libre))) libre += 1;

      numero = String(libre);
    }

    usados.add(numero);

    return { ...token, label: numero };
  });
}

/**
 * Las escenas de un tablero ya guardado, sin números repetidos en ningún
 * equipo. Devuelve `null` si no había nada que arreglar: el tablero de los
 * onces que se rellenó antes del 21/10/2026 sigue con sus dos «6» hasta que
 * cambie la semana, y así se arregla al abrirlo.
 */
export function escenasSinNumeroRepetido<E extends { tokens: TacticToken[] }>(escenas: E[]): E[] | null {
  let cambio = false;

  const salida = escenas.map((escena) => {
    const nuevos = new Map<string, string>();

    for (const kind of ["home", "away"] as const) {
      const equipo = escena.tokens.filter((token) => token.kind === kind);

      for (const token of sinNumeroRepetido(equipo)) {
        if (token.label !== equipo.find((t) => t.id === token.id)?.label) nuevos.set(token.id, token.label);
      }
    }

    if (nuevos.size === 0) return escena;

    cambio = true;

    return { ...escena, tokens: escena.tokens.map((token) => (nuevos.has(token.id) ? { ...token, label: nuevos.get(token.id)! } : token)) };
  });

  return cambio ? salida : null;
}
