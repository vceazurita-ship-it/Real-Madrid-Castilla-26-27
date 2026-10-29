/*
|--------------------------------------------------------------------------
| EL ONCE DE EMOTION SALE DE LA PIZARRA TÁCTICA (29/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «la sección de emocional debe actualizarse según la
| pizarra táctica el once». El tablero «Once 4-2-3-1» se rellena solo cada
| semana (`lib/tactics/oncesSemana.ts`) y se cambia a mano pinchando una
| ficha; aquí se lee ese mismo documento —sólo lectura, GET a /api/docs— y se
| colocan nuestras once fichas donde están en la pizarra. Si el analista mueve
| o cambia a alguien allí, Emotion lo enseña al recargar.
|
| Se casa por NOMBRE y nunca por ID: los JUG-XX de la hoja se renumeran, y la
| hoja emocional además escribe «M. Rezola» o «Roberto» donde la pizarra pone
| el apodo o el nombre completo.
*/

import { mismoJugador } from "@/lib/fichajes";
import { PITCH_HEIGHT, type TacticToken, type TacticsDoc } from "@/lib/tactics/types";

/** El nombre del tablero de los onces, el mismo que en `app/pizarra-tactica`. */
export const TABLERO_DE_ONCES = "Once 4-2-3-1";

export type FichaOnce = {
  id: string;
  /** Lo que pone la pizarra (apodo o nombre). */
  nombre: string;
  dorsal: string;
  foto?: string;
  /** Sitio en el campo, en % del largo (0 = nuestra portería) y del ancho (0 = banda izquierda). */
  largo: number;
  ancho: number;
};

export type OnceDeLaPizarra = {
  fichas: FichaOnce[];
  /** «Onces · UD Ibiza»: el nombre de la escena, para decir de dónde sale. */
  escena: string;
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

/** Nuestro once tal y como está ahora en la pizarra, o `null` si no hay tablero de onces. */
export async function onceDeLaPizarra(): Promise<OnceDeLaPizarra | null> {
  const indice = await leeDoc<{ boards?: { id: string; nombre: string }[] }>("tactics:index");
  const tablero = (indice?.boards ?? []).find((b) => b.nombre === TABLERO_DE_ONCES);

  if (!tablero) return null;

  const doc = await leeDoc<TacticsDoc>(`tactics:board:${tablero.id}`);
  const escenas = Array.isArray(doc?.scenes) ? (doc?.scenes ?? []) : [];
  const nuestros = (tokens: TacticToken[] | undefined) => (tokens ?? []).filter((t) => t.kind === "home");

  /* La escena de los onces («Onces · rival») manda; si el analista la
     renombró, la primera con un once casi entero. */
  const escena =
    escenas.find((e) => /^onces/i.test(e.nombre ?? "") && nuestros(e.tokens).length >= 7) ??
    escenas.find((e) => nuestros(e.tokens).length >= 7);

  if (!escena) return null;

  const tokens = nuestros(escena.tokens);

  /*
  | En la pizarra nuestro equipo va comprimido en su mitad (x ≈ 10-45). Se
  | estira al campo entero con el mínimo y el máximo de las fichas, no con
  | constantes: así lo que el analista haya movido a mano se respeta.
  */
  const xs = tokens.map((t) => t.x);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const tramo = max - min;

  return {
    escena: escena.nombre ?? "",
    fichas: tokens.map((t) => ({
      id: t.id,
      nombre: (t.nombre ?? "").trim(),
      dorsal: t.label,
      foto: t.foto,
      largo: tramo > 0.5 ? 7 + ((t.x - min) / tramo) * 84 : 50,
      ancho: Math.min(92, Math.max(8, (t.y / PITCH_HEIGHT) * 100)),
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  CASAR NOMBRES                                                      */
/* ------------------------------------------------------------------ */

const palabras = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

/**
 * Lo fuerte que casan dos nombres: 3 idénticos, 2 apellido con inicial
 * («M. Rezola» = «Mario Rezola»), 1 un nombre suelto dentro del otro
 * («Roberto» = «Roberto Martín»); 0, no casan.
 */
export function casaNombre(a: string, b: string): number {
  const x = palabras(a);
  const y = palabras(b);

  if (!x.length || !y.length) return 0;
  if (x.join(" ") === y.join(" ")) return 3;
  if (mismoJugador(a, b)) return 2;
  if ((x.length === 1 && y.includes(x[0])) || (y.length === 1 && x.includes(y[0]))) return 1;

  return 0;
}

/** El mejor de `candidatos` para cualquiera de los `nombres`, sin repetir los ya `usados`. */
export function mejorCasado<T>(nombres: string[], candidatos: T[], nombresDe: (c: T) => (string | undefined)[], usados?: Set<T>): T | undefined {
  let mejor: T | undefined;
  let fuerza = 0;

  for (const c of candidatos) {
    if (usados?.has(c)) continue;

    for (const n of nombres) {
      for (const otro of nombresDe(c)) {
        const f = otro ? casaNombre(n, otro) : 0;

        if (f > fuerza) {
          fuerza = f;
          mejor = c;
        }
      }
    }
  }

  return mejor;
}
