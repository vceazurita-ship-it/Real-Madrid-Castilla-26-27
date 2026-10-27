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
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizarOnce, playerKey, rivalOnceKey } from "@/lib/rivals/once";
import type { RatingsSeason } from "@/lib/ratings/types";
import type { Player } from "@/types/player";

import { DIBUJO_DE_PARTIDA, numerosDelOnce } from "./dosOnces";
import { fuenteUltimoOnce, huecosDelUltimoOnce } from "./ultimoOnce";
import { rivalTokenId } from "./rivals";
import { PITCH_HEIGHT, type TacticToken } from "./types";

type Fila = Record<string, unknown>;

const texto = (v: unknown) => String(v ?? "").trim();

/** El hueco de `proponeOnce` → la ficha del 4-2-3-1 de `lib/formations` (nosotros atacando a la derecha). */
const FICHA_DEL_HUECO: Record<string, string> = {
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

/** El número de la camiseta de cada hueco, como en `dosOnces`. */
const NUMERO_DEL_HUECO: Record<string, string> = { por: "1", "lat-d": "2", "lat-i": "3", "cen-d": "4", "cen-i": "5", "piv-d": "6", "piv-i": "8", "ban-d": "7", media: "10", "ban-i": "11", del: "9" };

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

/** La semana del próximo partido, sin cargar nada más: para saber si hay que rellenar. */
export async function semanaActual(): Promise<{ semana: string; rival: string; fecha: string; lado: "casa" | "fuera"; anteriorCuando: string | null } | null> {
  const partidos = await cargaCalendario();
  const { proximo, anterior } = alrededorDe(partidos, Date.now());

  return proximo
    ? { semana: `${soloDia(proximo.cuando)}|${proximo.rival}`, rival: proximo.rival, fecha: soloDia(proximo.cuando), lado: proximo.lado, anteriorCuando: anterior?.cuando ?? null }
    : null;
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
    jugadores.map((j) => ({ id: j.clave, sitio: j.sitio, minutos: enBase.has(j.clave) ? 10_000 : 0 })),
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

/** Los veintidós de la semana. */
export async function oncesDeLaSemana(plantilla: Player[]): Promise<OncesSemana | null> {
  const semana = await semanaActual();

  if (!semana) return null;

  const [temporada, suyo] = await Promise.all([
    traeJson<{ success?: boolean; season?: RatingsSeason }>("/api/ratings/load")
      .then((r) => (r?.success ? r.season ?? null : null))
      .catch(() => null),
    suOnceTeorico(semana.rival),
  ]);

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
