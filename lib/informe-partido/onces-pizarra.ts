/**
 * EL ONCE DE LA PIZARRA TÁCTICA, PARA LA PREVIA (26/10/2026).
 *
 * El tablero «Once 4-2-3-1» de /pizarra-tactica se rellena cada semana con los
 * dos onces y el analista lo retoca a mano (pinchar una ficha cambia al
 * jugador). La previa lo toma como primera fuente, antes que Valoraciones,
 * Duelos o el once marcado en Plantillas.
 *
 * SÓLO LECTURA: nada de esto escribe en la pizarra. Si el tablero no es del
 * partido del informe (`semanaOnces` = «AAAA-MM-DD|rival»), devuelve `null` y
 * el informe sigue con lo de siempre, sin decir nada.
 *
 * Cada ficha se asigna al hueco del 4-2-3-1 más cercano a donde está en el
 * campo (el rival, media vuelta), de modo que «colocado como en el tablero»
 * sobrevive a que el analista haya cambiado las fichas de sitio.
 */
import { soloDia } from "@/lib/castilla/calendario";
import { HUECOS, casaNombre } from "@/lib/data-analisis/once";
import { mismoClub } from "@/lib/rivals/mismoClub";
import type { OncePos } from "@/lib/rivals/once";
import { PITCH_HEIGHT, type TacticToken } from "@/lib/tactics/types";
import { sitioDelHueco } from "@/lib/tactics/oncesSemana";

const TABLERO_DE_ONCES = "Once 4-2-3-1";

type Fila = Record<string, unknown>;

export type PizarraOnces = {
  /** hueco → id de nuestra ficha. */
  nuestro: Record<string, string>;
  /** hueco → clave del jugador rival (la de `playerKey`). */
  suyo: Record<string, string>;
  /** Las claves del once rival, de la portería al ataque. */
  titulares: string[];
  /** Dónde cae cada uno del rival en el campograma (tanto por uno, ataque arriba). */
  campo: Record<string, OncePos>;
};

const texto = (v: unknown) => String(v ?? "").trim();

async function leeDoc<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    const j = (await r.json()) as { data?: T | null };

    return j?.data ?? null;
  } catch {
    return null;
  }
}

/** Cada ficha al hueco libre más cercano a donde está, de la más cercana a la más lejana. */
function huecosPorCercania(tokens: { x: number; y: number }[]) {
  const pares = tokens
    .flatMap((t, i) =>
      HUECOS.map((h) => {
        const s = sitioDelHueco(h.clave);

        return { i, hueco: h.clave, d: (t.x - s.x) ** 2 + (t.y - s.y) ** 2 };
      }),
    )
    .sort((a, b) => a.d - b.d);

  const tokenUsado = new Set<number>();
  const huecoUsado = new Set<string>();
  const salida = new Map<number, string>();

  for (const par of pares) {
    if (tokenUsado.has(par.i) || huecoUsado.has(par.hueco)) continue;

    tokenUsado.add(par.i);
    huecoUsado.add(par.hueco);
    salida.set(par.i, par.hueco);
  }

  return salida;
}

export async function leePizarraOnces(entrada: {
  /** El partido del informe. */
  cuando: string;
  rival: string;
  /** Nuestra plantilla. */
  fichas: { id: string; nombre: string; apodo?: string }[];
  /** Las filas de la hoja del rival, ya filtradas a su equipo. */
  filasRival: Fila[];
  /** Para nombrar la clave del jugador rival. */
  claveDe: (fila: Fila) => string;
  /** Mismo id de ficha que usa la pizarra para un rival. */
  idFichaRival: (fila: Fila) => string;
}): Promise<PizarraOnces | null> {
  try {
    const indice = await leeDoc<{ boards?: { id: string; nombre: string }[] }>("tactics:index");
    const tablero = (indice?.boards ?? []).find((b) => b.nombre === TABLERO_DE_ONCES);

    if (!tablero) return null;

    const doc = await leeDoc<{ semanaOnces?: string; scenes?: { tokens?: TacticToken[] }[] }>(`tactics:board:${tablero.id}`);
    const [dia, rivalDelTablero] = String(doc?.semanaOnces ?? "").split("|");

    if (!dia || dia !== soloDia(entrada.cuando) || !rivalDelTablero || !mismoClub(rivalDelTablero, entrada.rival)) return null;

    const tokens = (doc?.scenes?.[0]?.tokens ?? []).filter((t) => t && Number.isFinite(t.x) && Number.isFinite(t.y));

    /* ---------------- nuestro once ---------------- */
    const nuestros = tokens.filter((t) => t.kind === "home" && texto(t.nombre));
    const nuestro: Record<string, string> = {};

    const deHueco = huecosPorCercania(nuestros);

    nuestros.forEach((t, i) => {
      const nombre = texto(t.nombre);
      const ficha =
        entrada.fichas.find((f) => f.nombre === nombre || f.apodo === nombre) ??
        casaNombre(nombre, entrada.fichas, (f) => f.nombre) ??
        casaNombre(nombre, entrada.fichas, (f) => f.apodo ?? "");
      const hueco = deHueco.get(i);

      if (ficha && hueco) nuestro[hueco] = ficha.id;
    });

    /* ---------------- su once ---------------- */
    const porToken = new Map(entrada.filasRival.map((f) => [entrada.idFichaRival(f), f]));
    const suyosTokens = tokens.filter((t) => t.kind === "away");

    /* Media vuelta: se mide como si atacaran hacia la derecha, igual que nosotros. */
    const deHuecoSuyo = huecosPorCercania(suyosTokens.map((t) => ({ x: 100 - t.x, y: PITCH_HEIGHT - t.y })));
    const suyo: Record<string, string> = {};
    const campo: Record<string, OncePos> = {};
    const profundidad = new Map<string, number>();

    suyosTokens.forEach((t, i) => {
      const nombre = texto(t.nombre);
      const fila = porToken.get(t.id) ?? (nombre ? casaNombre(nombre, entrada.filasRival, (f) => texto(f["NOMBRE DEPORTIVO"]) || texto(f.JUGADOR)) : null);

      if (!fila) return;

      const clave = entrada.claveDe(fila);
      const hueco = deHuecoSuyo.get(i);

      if (hueco) suyo[hueco] = clave;

      /* Su portería está en x≈90 y atacan hacia x≈55; su izquierda es nuestra «abajo» del tablero. */
      const d = Math.max(0, Math.min(1, (90 - t.x) / 35));

      campo[clave] = { x: Math.max(0.06, Math.min(0.94, 1 - t.y / PITCH_HEIGHT)), y: 0.88 - d * 0.68 };
      profundidad.set(clave, d);
    });

    const titulares = [...profundidad.entries()].sort((a, b) => a[1] - b[1]).map(([clave]) => clave);

    if (Object.keys(nuestro).length < 7 && titulares.length < 7) return null;

    return {
      nuestro: Object.keys(nuestro).length >= 7 ? nuestro : {},
      suyo: titulares.length >= 7 ? suyo : {},
      titulares: titulares.length >= 7 ? titulares : [],
      campo: titulares.length >= 7 ? campo : {},
    };
  } catch {
    return null;
  }
}
