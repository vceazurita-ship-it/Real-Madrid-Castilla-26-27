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
import { HUECOS, casaNombre, proponeOnce, sitioDe, type Candidato } from "@/lib/data-analisis/once";
import { formations } from "@/lib/formations";
import { traeJson } from "@/lib/hojaCsv";
import { findInforme, type InformeDoc } from "@/lib/rivals/informe";
import { slugClave } from "@/lib/rivals/media";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizarOnce, playerKey, rivalOnceKey } from "@/lib/rivals/once";
import type { RatingsSeason } from "@/lib/ratings/types";
import type { Player } from "@/types/player";

import { DIBUJO_DE_PARTIDA } from "./dosOnces";
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
export async function semanaActual(): Promise<{ semana: string; rival: string; anteriorCuando: string | null } | null> {
  const partidos = await cargaCalendario();
  const { proximo, anterior } = alrededorDe(partidos, Date.now());

  return proximo ? { semana: `${soloDia(proximo.cuando)}|${proximo.rival}`, rival: proximo.rival, anteriorCuando: anterior?.cuando ?? null } : null;
}

/* ------------------------------------------------------------------ */
/*  NUESTRO ÚLTIMO ONCE                                                */
/* ------------------------------------------------------------------ */

function nuestroUltimoOnce(temporada: RatingsSeason | null, plantilla: Player[]) {
  const hoy = new Date().toISOString().slice(0, 10);
  const partidos = Object.values(temporada?.matches ?? {})
    .filter((m) => !(temporada?.ocultos ?? []).includes(m.match.id))
    .filter((m) => m.match.date && m.match.date <= hoy)
    .map((m) => ({ m, titulares: Object.values(m.players).filter((p) => p.starter) }))
    /* Un partido a medio valorar (el J7 tenía seis titulares marcados) sigue siendo el último: lo que falte sale del anterior. */
    .filter((x) => x.titulares.length >= 5)
    .sort((a, b) => b.m.match.date.localeCompare(a.m.match.date));

  const ultimo = partidos[0];
  const anterior = partidos.find((x, i) => i > 0 && x.titulares.length >= 9) ?? partidos[1];
  const delCastilla = plantilla.filter((p) => p.esCastilla !== false);
  const porId = new Map(plantilla.map((p) => [p.id, p]));

  /*
  | Los titulares del último partido primero; si no llegan a once, los del
  | anterior; y el resto de la plantilla sólo para tapar un hueco que quede.
  */
  const peso = new Map<string, number>();

  for (const t of anterior?.titulares ?? []) peso.set(t.playerId, 5_000);
  for (const t of ultimo?.titulares ?? []) peso.set(t.playerId, 10_000);

  const completado = (ultimo?.titulares.length ?? 0) < 11 && anterior && anterior !== ultimo;
  const candidatos: Candidato[] = delCastilla.map((p) => ({ id: p.id, sitio: sitioDe(String(p.posicion ?? ""), null), minutos: peso.get(p.id) ?? 0 }));

  const huecos = proponeOnce(candidatos);

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

  const fuente = ultimo
    ? `Nuestro último once: ${ultimo.m.match.opponent}${ultimo.m.match.result ? ` (${ultimo.m.match.result})` : ""}, ${ultimo.m.match.date.split("-").reverse().join("/")}${completado ? ` (completado con el de ${anterior!.m.match.opponent}: faltan titulares por marcar en Valoraciones)` : ""}`
    : "Sin titulares en Valoraciones: once por puesto de la plantilla";

  return { tokens, fuente };
}

/* ------------------------------------------------------------------ */
/*  SU ONCE TEÓRICO                                                    */
/* ------------------------------------------------------------------ */

async function suOnceTeorico(rival: string) {
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

  const [duelos, onceDoc] = await Promise.all([leeDoc<{ suyo?: Record<string, string> }>(`duelos:${slugClave(equipo)}`), leeDoc<unknown>(rivalOnceKey(equipo))]);

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

  return { tokens, fuente, equipo };
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

  const nuestro = nuestroUltimoOnce(temporada, plantilla);

  return { semana: semana.semana, rival: suyo.equipo, tokens: [...nuestro.tokens, ...suyo.tokens], fuenteNuestra: nuestro.fuente, fuenteSuya: suyo.fuente };
}
