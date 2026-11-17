/**
 * LOS CLIPS DE HUDL DE CADA JUGADOR RIVAL (17/11/2026).
 *
 * Lo pidió el analista: «desde Wyscout exporto cortes de un jugador y los
 * llevo a Hudl; quiero poder bajarme esos clips a mi portátil desde la app».
 * En Hudl quedan como LISTAS (PlaylistItem) con el título «RIVAL - Nº»,
 * «RIVAL - NOMBRE» o «RIVAL - Nº NOMBRE» («UD IBIZA - YOLDI», «MURCIA - 23
 * FLAKUS»). `scripts/hudl-clips-rival.mjs` las encuentra en la biblioteca del
 * equipo, baja cada clip a 720p y lo sube a B2; aquí están la forma del
 * documento y las reglas para casar cada lista con su rival y su jugador.
 *
 * Lo comparten el script (por `scripts/cargador-ts.cjs`) y la pantalla, así
 * que no importa nada de React ni del servidor.
 */

import { mismoEquipo } from "@/lib/rivals/resumen-de-partido";
import { desnuda } from "@/lib/rivals/youtube-listas";

export const CLAVE_HUDL_CLIPS = "hudl:clips-rival";

export type ClipHudl = {
  /** El id del clip en la lista de Hudl (estable: sirve para no rebajarlo). */
  id: string;
  /** «A. Yoldi - Ocasiones de gol, Remates». */
  titulo: string;
  /** «19/09/2026 Real Jaén-Ibiza 2-1». */
  descripcion?: string;
  /** La ruta de la web que sirve el mp4 desde B2 (`/api/video/…`). */
  url: string;
  bytes: number;
  segundos?: number;
};

export type ListaHudl = {
  /** «UD IBIZA - YOLDI», tal cual está en Hudl. */
  titulo: string;
  /** «UD IBIZA». */
  rival: string;
  dorsal?: string;
  /** «YOLDI», «MANU JUSTO». */
  nombre?: string;
  /** `updatedAt` de la lista en Hudl: si cambia, se mira de nuevo. */
  actualizada?: string;
  /** Cuántos clips tiene en Hudl. */
  enHudl: number;
  /** Cuándo se bajó lo último. */
  bajadaEn?: string;
  /** Los ya bajados, en el orden de la lista. */
  clips: ClipHudl[];
};

export type DocHudlClips = { listas: Record<string, ListaHudl>; actualizado?: string };

/* Lo que va detrás del guion: «23», «FLAKUS», «23 FLAKUS», «MANU JUSTO», «A. YOLDI». */
const TRAS_GUION = /^(?:(\d{1,2})\s*)?([\p{L}][\p{L}.' -]{0,40})?$/u;

/**
 * «RIVAL - Nº NOMBRE» → sus partes, o null si el título no es de ese tipo.
 * El rival no lleva cifras (así no casan «20181219 RM CASTILLA…» ni
 * «2018_11Dic_calentamiento») y el jugador, como mucho, tres palabras.
 */
export function leeTituloLista(titulo: string): { rival: string; dorsal?: string; nombre?: string } | null {
  const t = String(titulo ?? "").replace(/\s+/g, " ").trim();
  const corte = t.match(/^(.+?)\s+[-–]\s+(.+)$/);

  if (!corte) return null;

  const rival = corte[1].trim();
  const resto = corte[2].trim();

  if (rival.length < 3 || rival.length > 40 || /\d/.test(rival) || !/^[\p{L} .'&]+$/u.test(rival)) return null;

  const m = resto.match(TRAS_GUION);

  if (!m || (!m[1] && !m[2])) return null;

  const nombre = m[2]?.trim();

  if (nombre && nombre.split(" ").length > 3) return null;

  /* «NASTIC - RM CASTILLA» es un partido, no un jugador. */
  if (/castilla|real madrid|^rm\b|\brmc?$/i.test(`${rival} | ${nombre ?? ""}`)) return null;

  return { rival, ...(m[1] ? { dorsal: String(Number(m[1])) } : {}), ...(nombre ? { nombre } : {}) };
}

/* Cómo lo escribe el analista en Hudl y cómo se llama en la hoja. */
const ALIAS_RIVAL: [RegExp, string][] = [[/^atl(etico|\.)? madrid$/, "Atlético Madrileño"]];

/** ¿El rival de la lista es este equipo? «UD IBIZA» = «UD Ibiza», «MURCIA» = «Real Murcia». */
export function esDelEquipo(lista: Pick<ListaHudl, "rival">, equipo: string) {
  if (!lista?.rival || !equipo) return false;

  const d = desnuda(lista.rival);
  const alias = ALIAS_RIVAL.find(([re]) => re.test(d))?.[1];

  return mismoEquipo(alias ?? lista.rival, equipo);
}

/** Las listas de un rival, la más reciente primero. */
export function listasDelEquipo(doc: DocHudlClips | null | undefined, equipo: string) {
  return Object.entries(doc?.listas ?? {})
    .filter(([, l]) => esDelEquipo(l, equipo))
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => String(b.actualizada ?? "").localeCompare(String(a.actualizada ?? "")));
}

export type ListaConId = ListaHudl & { id: string };

const fichas = (texto: string) => desnuda(texto).split(" ").filter((p) => p.length > 1);

/** ¿Las palabras de la lista están en el nombre del jugador? «YOLDI» ⊂ «ANDER YOLDI»; «JUSTO» casa «Manu Justo». */
function casaNombre(nombreLista: string, nombresJugador: string[]) {
  const buscadas = fichas(nombreLista);

  if (!buscadas.length) return false;

  return nombresJugador.some((n) => {
    const suyas = fichas(n);

    /* Prefijo sólo con 1-2 letras de diferencia (17/11/2026): «MARTIN» no es «Martínez». */
    const casiIgual = (b: string, s: string) => b.length > 4 && s.length > 4 && Math.abs(b.length - s.length) <= 2 && (s.startsWith(b) || b.startsWith(s));

    return buscadas.every((b) => suyas.some((s) => s === b || casiIgual(b, s)));
  });
}

/**
 * Las listas de un jugador entre las de su rival.
 *
 * Primero por nombre (o apellido): los dorsales de la hoja se han movido
 * alguna vez (memoria dorsales-plantilla-y-rivales). Si la lista sólo trae el
 * número, por dorsal; si trae los dos y el nombre casa a varios, el dorsal
 * decide.
 */
export function listasDelJugador(listas: ListaConId[], jugador: { nombres: string[]; dorsal?: string | number | null }, plantilla?: { nombres: string[]; dorsal?: string | number | null }[]) {
  const dorsal = String(jugador.dorsal ?? "").trim().replace(/^0+(?=\d)/, "");

  return listas.filter((l) => {
    if (l.nombre) {
      if (!casaNombre(l.nombre, jugador.nombres)) return false;

      /* El nombre casa a más de uno de la plantilla: decide el dorsal, si lo hay. */
      const casan = plantilla?.filter((p) => casaNombre(l.nombre!, p.nombres)).length ?? 1;

      if (casan <= 1) return true;
      if (l.dorsal) return l.dorsal === dorsal;

      /* Varios casan y no hay dorsal (17/11/2026): sólo el único que tiene
         todas las palabras tal cual; si no, a nadie («ALEX» no son los clips
         de los dos Álex; «MARTIN» es Martín Ruiz, no Martínez). */
      const buscadas = fichas(l.nombre!);
      const exacto = (n: string) => {
        const suyas = fichas(n);
        return buscadas.every((b) => suyas.includes(b));
      };
      const iguales = plantilla?.filter((p) => p.nombres.some(exacto)).length ?? 0;

      return iguales === 1 && jugador.nombres.some(exacto);
    }

    return Boolean(l.dorsal) && l.dorsal === dorsal;
  });
}

/** Sin los caracteres que Windows no deja en un nombre de fichero. */
export const limpiaNombre = (t: string) =>
  String(t ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90)
    .replace(/[. ]+$/, "");

/** «UD IBIZA - YOLDI - 01 - A. Yoldi - Ocasiones de gol, Remates.mp4». */
export function nombreDelClip(lista: Pick<ListaHudl, "titulo">, clip: Pick<ClipHudl, "titulo">, n: number) {
  return `${limpiaNombre(lista.titulo)} - ${String(n).padStart(2, "0")} - ${limpiaNombre(clip.titulo) || "clip"}.mp4`;
}

/** Lo que pesa una tanda, para decirlo antes de bajarla: «12,4 MB». */
export function pesoLegible(bytes: number) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GB` : `${(bytes / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

/** Normaliza lo que venga del documento (puede no existir todavía). */
export function normalizaDocHudl(valor: unknown): DocHudlClips {
  const listas = (valor as DocHudlClips | null)?.listas;

  if (!listas || typeof listas !== "object") return { listas: {} };

  const limpias: Record<string, ListaHudl> = {};

  for (const [id, l] of Object.entries(listas)) {
    if (!l || typeof l !== "object" || !l.titulo) continue;

    limpias[id] = { ...l, enHudl: Number(l.enHudl) || 0, clips: Array.isArray(l.clips) ? l.clips.filter((c) => c?.url) : [] };
  }

  return { listas: limpias, actualizado: (valor as DocHudlClips).actualizado };
}
