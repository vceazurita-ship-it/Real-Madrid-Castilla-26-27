/**
 * LA PIZARRA DEL PARTIDO, LEÍDA PARA «PARA HOY» (31/10/2026).
 *
 * Lo pidió el analista: el bloque «Para hoy» del informe previo de ABP
 * (Defensa / Marcas / Ataque) «tiene que tener correlación con la pizarra de
 * ABP guardada para el partido y con el once titular». Salían de marcadores
 * los más altos de Wyscout (S. Martínez, Rachad Fettal) aunque no fueran
 * titulares y Joan marcando a su mejor rematador cuando en la pizarra es el
 * del balón; y de rematadores, Meso, que no estaba en el once.
 *
 * Aquí se lee el tablero guardado de esa jornada (`abp-pizarra`) con el once
 * de la pizarra táctica (el mismo que usa «Poner el once» en /abp-pizarra):
 *
 *   · Córner defensivo: quién está en cada marca (y el dorsal del rival, si
 *     «Quién marca a quién» lo dejó puesto en `slide.marcas`), quién en la
 *     corta, al balón y al juego en corto.
 *   · Córner ofensivo: quién saca (la consigna «sacador X» o, si no, el que
 *     está en el saque), para quién va ensayada una rutina y quién remata.
 *
 * Sólo cuentas, sin red: quien llama trae el tablero, la plantilla y el once.
 * Nadie que no esté en el once sale de aquí.
 */

import { poderAereo } from "./marcas-corner";
import { puestosDe, type SlidePizarra, type TableroPizarra } from "./pizarra";
import { sitioDe } from "@/lib/data-analisis/once";
import { casaNombre } from "@/lib/tactics/onceDeLaPizarra";

type JugadorPlantilla = { id: string; nombre: string; apodo?: string; posicion?: string };

export type JugadorDelOnce = {
  id: string;
  /** Como lo escribe la pizarra: el apodo («Joan», «Aguado»). */
  nombre: string;
  /** Las otras formas de llamarle, para casar nombres de las hojas y de Wyscout. */
  otros: string[];
};

export type MarcadorPizarra = {
  id: string;
  nombre: string;
  /** La sigla de su chapa: «M1»…«M7». */
  sigla: string;
  /** En cm, si se sabe. */
  altura: number | null;
  /** Lo que vale defendiendo por arriba (`poderAereo`): ordena a los nuestros. */
  poder: number;
  /** El dorsal del rival que marca, si la pizarra lo tiene puesto. */
  dorsalRival: string;
};

export type PizarraParaInforme = {
  /** El once de la pizarra táctica. Vacío: no se sabe, y no se filtra. */
  once: JugadorDelOnce[];
  cornerDef: {
    marcadores: MarcadorPizarra[];
    corta: string[];
    balon: string[];
    juegoCorto: string[];
  } | null;
  cornerOf: {
    sacador: string;
    /** «Directa a punto de penalti para Joan»: el rematador de la rutina y a qué córner va. */
    ensayado: { para: string; ordinal: string } | null;
    /** Los del grupo de rematadores de la primera diapositiva de córner. */
    rematadores: string[];
  } | null;
};

const ORDINAL = /\b(primer|segundo|tercer|cuarto|quinto)\s+c[oó]rner\b/i;

/** El jugador del once que casa con un nombre suelto de la pizarra o de una hoja. */
export function delOnce(once: JugadorDelOnce[], nombre: string): JugadorDelOnce | null {
  if (!nombre.trim()) return null;

  let mejor: JugadorDelOnce | null = null;
  let fuerza = 0;

  for (const uno of once) {
    for (const otro of [uno.nombre, ...uno.otros]) {
      const f = casaNombre(nombre, otro);

      if (f > fuerza) {
        fuerza = f;
        mejor = uno;
      }
    }
  }

  return mejor;
}

export function pizarraParaInforme(entrada: {
  tablero: TableroPizarra | null;
  players: JugadorPlantilla[];
  /** Ids de la plantilla del once de la pizarra táctica (`idsDelOnce`). */
  onceIds: string[];
  /** Alturas escritas a mano en «Quién marca a quién» (`abp:alturas-nuestros`, cm por id). */
  alturas?: Record<string, number> | null;
  /** Nuestras alturas de Wyscout. */
  aereos?: { nombre: string; altura: number; posicion?: string }[] | null;
}): PizarraParaInforme | null {
  const { tablero, players } = entrada;

  const porId = new Map(players.map((p) => [p.id, p]));

  const nombreDe = (id: string) => {
    const p = porId.get(id);

    return p ? (p.apodo || p.nombre).trim() : "";
  };

  const once: JugadorDelOnce[] = entrada.onceIds
    .map((id) => porId.get(id))
    .filter((p): p is JugadorPlantilla => Boolean(p))
    .map((p) => ({ id: p.id, nombre: (p.apodo || p.nombre).trim(), otros: [p.nombre, p.apodo ?? ""].filter((n) => n && n !== p.apodo) }));

  const enOnce = new Set(once.map((uno) => uno.id));

  /* Sin once conocido no se filtra: se lee la pizarra tal cual. */
  const vale = (id: string) => Boolean(nombreDe(id)) && (enOnce.size === 0 || enOnce.has(id));

  if (!tablero?.slides?.length) return once.length ? { once, cornerDef: null, cornerOf: null } : null;

  const ocupantes = (slide: SlidePizarra, grupo: string) =>
    puestosDe(slide)
      .filter((puesto) => puesto.grupo === grupo)
      .map((puesto) => ({ puesto, ficha: slide.fichas.find((f) => f.puesto === puesto.key) }))
      .filter((una) => una.ficha && vale(una.ficha.playerId));

  const alturaDe = (id: string): number | null => {
    const escrita = entrada.alturas?.[id];

    if (typeof escrita === "number" && escrita > 0) return escrita;

    const p = porId.get(id);

    if (!p) return null;

    const wy = (entrada.aereos ?? []).find((uno) => uno.altura > 0 && [p.nombre, p.apodo ?? ""].some((n) => n && casaNombre(uno.nombre, n) >= 2));

    return wy?.altura ?? null;
  };

  /* ---------------- córner defensivo ---------------- */

  const def = tablero.slides.find((s) => s.plantilla === "corner-def");

  const cornerDef = def
    ? {
        marcadores: ocupantes(def, "marcas").map(({ puesto, ficha }) => {
          const id = ficha!.playerId;
          const altura = alturaDe(id);

          return {
            id,
            nombre: nombreDe(id),
            sigla: puesto.sigla ?? puesto.code,
            altura,
            poder: poderAereo({
              playerId: id,
              nombre: nombreDe(id),
              rol: sitioDe(porId.get(id)?.posicion ?? "", null).puesto,
              posicion: porId.get(id)?.posicion ?? "",
              altura,
              aereoPct: null,
              aereos90: null,
              duelos: null,
              titular: true,
            }),
            dorsalRival: String(def.marcas?.[puesto.key] ?? "").trim(),
          };
        }),
        corta: ocupantes(def, "corta").map(({ ficha }) => nombreDe(ficha!.playerId)),
        balon: ocupantes(def, "zonas").map(({ ficha }) => nombreDe(ficha!.playerId)),
        juegoCorto: ocupantes(def, "fuera").map(({ ficha }) => nombreDe(ficha!.playerId)),
      }
    : null;

  /* ---------------- córner ofensivo ---------------- */

  const ofensivos = tablero.slides.filter((s) => s.plantilla === "corner-of");

  /*
  | El nombre que sigue a una palabra de la consigna, si es uno del once.
  | Todas las veces que sale: «… a zona 2 para central …» no es un nombre y
  | el «para Joan» de más allá sí.
  */
  const nombreTras = (texto: string, antes: RegExp) => {
    for (const encontrado of texto.matchAll(antes)) {
      const tras = encontrado[1] ?? "";

      if (once.length) {
        const candidato = delOnce(once, tras);

        if (candidato) return candidato.nombre;

        continue;
      }

      /* Sin once, el de la plantilla con ese nombre. */
      const p = players.find((uno) => [uno.nombre, uno.apodo ?? ""].some((n) => n && casaNombre(tras, n) >= 1));

      if (p) return (p.apodo || p.nombre).trim();
    }

    return "";
  };

  let sacador = "";
  let ensayado: { para: string; ordinal: string } | null = null;

  for (const slide of ofensivos) {
    const notas = (slide.notas ?? []).map((n) => String(n ?? "")).join(" · ");

    sacador ||= nombreTras(notas, /\bsacador:?\s+(\p{L}+)/giu) || nombreTras(notas, /\bsaca\s+(\p{L}+)/giu);

    if (!ensayado) {
      const para = nombreTras(notas, /\bpara\s+(\p{L}+)/giu);

      if (para) ensayado = { para, ordinal: (notas.match(ORDINAL)?.[1] ?? "").toLowerCase() };
    }
  }

  /*
  | Sin consigna que lo diga, el del saque: en la plantilla del córner
  | ofensivo es el puesto D1 (grupo «saque y corta», junto al banderín).
  */
  if (!sacador) {
    for (const slide of ofensivos) {
      const ficha = slide.fichas.find((f) => f.puesto === "corner-of:D1");

      if (ficha && vale(ficha.playerId)) {
        sacador = nombreDe(ficha.playerId);
        break;
      }
    }
  }

  const rematadores = ofensivos.length ? [...new Set(ocupantes(ofensivos[0], "rematadores").map(({ ficha }) => nombreDe(ficha!.playerId)))] : [];

  const cornerOf = ofensivos.length && (sacador || ensayado || rematadores.length) ? { sacador, ensayado, rematadores } : null;

  return { once, cornerDef, cornerOf };
}
