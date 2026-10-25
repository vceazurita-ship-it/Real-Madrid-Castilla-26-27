/**
 * EL PUENTE PIZARRA ↔ LABORATORIO: LO QUE SE GUARDA (25/10/2026).
 *
 * Una rutina que viene de la pizarra de ABP (`/abp-pizarra`) lleva dos cosas
 * que el resto de rutinas no tienen:
 *
 * - `origen`: de qué diapositiva y de qué partido salió, para listarla en
 *   «En la pizarra» y saber si sigue allí.
 * - `pizarra`: todo lo de la diapositiva que el laboratorio no sabe pintar
 *   —puestos de la plantilla, rótulos reescritos, rivales dibujados, carreras
 *   encadenadas, las coordenadas en píxeles— y una FIRMA de cómo quedó al
 *   convertirla. Al volver, lo que no se ha tocado en el laboratorio se
 *   devuelve tal cual estaba (píxel a píxel), y sólo lo cambiado se recalcula.
 *
 * Aquí sólo hay tipos y la limpieza de lo que llega al servidor
 * (`rutinaDe` en `modelo.ts`): nada de la pizarra se importa en tiempo de
 * ejecución, así la ruta de guardar no arrastra las plantillas.
 */

import type { GuionConsigna, TextosSlide, VistaCampo } from "@/lib/abp/pizarra";
import type { RivalPizarra, TrazoPizarra } from "@/lib/abp/trazos";

/** De dónde salió la rutina. */
export type OrigenPizarra = {
  /** El tablero (partido) de la pizarra. */
  partidoId: string;
  /** La diapositiva dentro del tablero. */
  slideId: string;
  /** El título de la diapositiva cuando se trajo. */
  titulo: string;
  rival: string;
  jornada?: string;
  /** Día del partido, AAAA-MM-DD, si el calendario lo sabe. */
  fecha?: string;
  /** ISO de cuándo se trajo (o se actualizó desde la pizarra). */
  traidaEn: string;
};

/** Cómo quedó cada papel en metros al convertirlo: lo que se compara al volver. */
export type FirmaRol = {
  jugador: string;
  x?: number;
  y?: number;
  hx?: number;
  hy?: number;
  fase?: number;
};

/** Una ficha de la diapositiva tal y como estaba, con su firma en metros. */
export type FichaGuardada = {
  id: string;
  playerId: string;
  puesto: string | null;
  /** Píxeles del lienzo de 1920×1080. */
  x: number;
  y: number;
  /** Nombre y dorsal al traerla: si mañana se renumeran los ids, se sigue sabiendo quién era. */
  nombre?: string;
  dorsal?: number;
  /** Las carreras que salen de sus pies, encadenadas (ids de trazo). */
  cadena: string[];
  /** Si entró en la rutina como papel (las de más del tope se quedan sólo aquí). */
  enLab: boolean;
  firma: FirmaRol;
};

export type ExtraPizarra = {
  v: 1;
  vista: VistaCampo;
  plantilla: string;
  titulo: string;
  rev?: number;
  notas: string[];
  textos?: TextosSlide;
  guion?: GuionConsigna;
  fichas: FichaGuardada[];
  /** Todos los trazos de la diapositiva, en píxeles, tal cual. */
  trazos: TrazoPizarra[];
  rivales: RivalPizarra[];
  /** Lo que se escribió en la rutina al convertirla, para saber qué se ha tocado. */
  firma: { nombre: string; idea: string; senal: string; balon?: { x: number; y: number }[] };
  /** La huella de la diapositiva al traerla: si la de la pizarra ya no coincide, ha cambiado allí. */
  huella: string;
};

/* ------------------------------------------------------------------ */
/*  LIMPIEZA (lo usa el servidor al guardar)                           */
/* ------------------------------------------------------------------ */

const txt = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

const num = (v: unknown): number | null => {
  const n = Number(v);

  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

const objeto = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);

export function origenDe(v: unknown): OrigenPizarra | null {
  const o = objeto(v);

  if (!o) return null;

  const partidoId = txt(o.partidoId, 80);

  const slideId = txt(o.slideId, 60);

  if (!partidoId || !slideId) return null;

  return {
    partidoId,
    slideId,
    titulo: txt(o.titulo, 120),
    rival: txt(o.rival, 80),
    ...(txt(o.jornada, 20) ? { jornada: txt(o.jornada, 20) } : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(txt(o.fecha, 10)) ? { fecha: txt(o.fecha, 10) } : {}),
    traidaEn: txt(o.traidaEn, 40),
  };
}

function firmaRolDe(v: unknown): FirmaRol {
  const f = objeto(v) ?? {};

  const r: FirmaRol = { jugador: txt(f.jugador, 60) };

  for (const k of ["x", "y", "hx", "hy", "fase"] as const) {
    const n = num(f[k]);

    if (n !== null) r[k] = n;
  }

  return r;
}

function trazoDe(v: unknown): TrazoPizarra | null {
  const t = objeto(v);

  if (!t) return null;

  const tipo = t.tipo === "balon" || t.tipo === "bloqueo" ? t.tipo : "carrera";

  const fase = t.fase === 1 || t.fase === 3 ? t.fase : 2;

  const [x1, y1, x2, y2] = [num(t.x1), num(t.y1), num(t.x2), num(t.y2)];

  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

  const cx = num(t.cx);

  const cy = num(t.cy);

  return {
    id: txt(t.id, 40) || `TR-${Math.random().toString(36).slice(2, 10)}`,
    tipo,
    fase,
    x1,
    y1,
    x2,
    y2,
    ...(cx !== null && cy !== null ? { cx, cy } : {}),
  };
}

function rivalDe(v: unknown): RivalPizarra | null {
  const r = objeto(v);

  const x = num(r?.x);

  const y = num(r?.y);

  if (!r || x === null || y === null) return null;

  return { id: txt(r.id, 40) || `RV-${Math.random().toString(36).slice(2, 10)}`, x, y, ...(txt(r.dorsal, 8) ? { dorsal: txt(r.dorsal, 8) } : {}) };
}

function textosDe(v: unknown): TextosSlide | undefined {
  const t = objeto(v);

  if (!t) return undefined;

  const g = objeto(t.grupos);

  const grupos = g ? Object.fromEntries(Object.entries(g).slice(0, 30).map(([k, x]) => [k.slice(0, 40), txt(x, 120)])) : undefined;

  const adornos = Array.isArray(t.adornos)
    ? lista(t.adornos, 12).map((a) => {
        const o = objeto(a) ?? {};

        return { ...(typeof o.label === "string" ? { label: txt(o.label, 120) } : {}), ...(typeof o.remate === "string" ? { remate: txt(o.remate, 120) } : {}) };
      })
    : undefined;

  if (!grupos && !adornos) return undefined;

  return { ...(grupos ? { grupos } : {}), ...(adornos ? { adornos } : {}) };
}

function guionDe(v: unknown): GuionConsigna | undefined {
  const g = objeto(v);

  if (!g) return undefined;

  const r: GuionConsigna = {};

  for (const k of ["senal", "rutina", "intencion"] as const) if (typeof g[k] === "string") r[k] = txt(g[k], 300);

  return Object.keys(r).length ? r : undefined;
}

/** Lo extra de la pizarra, limpio y con topes; `null` si no se entiende. */
export function extraPizarraDe(v: unknown): ExtraPizarra | null {
  const e = objeto(v);

  if (!e || e.v !== 1) return null;

  const firma = objeto(e.firma) ?? {};

  const fichas = lista(e.fichas, 40)
    .map((f): FichaGuardada | null => {
      const o = objeto(f);

      const x = num(o?.x);

      const y = num(o?.y);

      if (!o || x === null || y === null || !txt(o.id, 40)) return null;

      const dorsal = num(o.dorsal);

      return {
        id: txt(o.id, 40),
        playerId: txt(o.playerId, 60),
        puesto: typeof o.puesto === "string" ? txt(o.puesto, 60) : null,
        x,
        y,
        ...(txt(o.nombre, 60) ? { nombre: txt(o.nombre, 60) } : {}),
        ...(dorsal !== null ? { dorsal } : {}),
        cadena: lista(o.cadena, 6).map((id) => txt(id, 40)).filter(Boolean),
        enLab: o.enLab !== false,
        firma: firmaRolDe(o.firma),
      };
    })
    .filter((x): x is FichaGuardada => Boolean(x));

  const balon = Array.isArray(firma.balon)
    ? lista(firma.balon, 6)
        .map((p) => {
          const o = objeto(p);

          const x = num(o?.x);

          const y = num(o?.y);

          return x === null || y === null ? null : { x, y };
        })
        .filter((p): p is { x: number; y: number } => Boolean(p))
    : undefined;

  const textos = textosDe(e.textos);

  const guion = guionDe(e.guion);

  const rev = num(e.rev);

  return {
    v: 1,
    vista: e.vista === "porteria" ? "porteria" : "ancho",
    plantilla: txt(e.plantilla, 40) || "libre",
    titulo: txt(e.titulo, 120),
    ...(rev !== null ? { rev } : {}),
    notas: lista(e.notas, 20).map((n) => txt(n, 300)),
    ...(textos ? { textos } : {}),
    ...(guion ? { guion } : {}),
    fichas,
    trazos: lista(e.trazos, 120).map(trazoDe).filter((x): x is TrazoPizarra => Boolean(x)),
    rivales: lista(e.rivales, 30).map(rivalDe).filter((x): x is RivalPizarra => Boolean(x)),
    firma: { nombre: txt(firma.nombre, 80), idea: txt(firma.idea, 1200), senal: txt(firma.senal, 80), ...(balon ? { balon } : {}) },
    huella: txt(e.huella, 40),
  };
}
