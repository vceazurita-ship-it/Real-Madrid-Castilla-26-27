/**
 * LO QUE SE COLOCA AL ENSEÑAR UNA LÁMINA (12/11/2026, tercera ronda de jueces).
 *
 * Sale de `TableroSlide` para que la lámina general, el PowerPoint, el PDF de
 * cada jugador y el arnés que las valida coloquen igual: el ancho de cada
 * chapa, el dorsal y el apellido de cada rival, a quién se pega la letra de
 * cada consigna y, con todo eso, dónde va cada cosa (`lib/abp/separa.ts`).
 */

import {
  apartaRivales,
  cajasPortero,
  cajasPorteroFigura,
  colocaInsignias,
  ladoNombrePortero,
  lienzoA,
  separaFichas,
  solapesDeLamina,
  type Apartados,
  type Caja,
  type LadoNombre,
  type Separadas,
} from "@/lib/abp/separa";
import { admiteRepetidos, gruposDe, puestoDe, type FichaPizarra, type SlidePizarra } from "@/lib/abp/pizarra";
import type { AtacantePanel } from "@/lib/abp/marcas-corner";
import type { RivalPizarra } from "@/lib/abp/trazos";
import type { Player } from "@/types/player";

/**
 * EL MISMO TAMAÑO DE CARA EN TODAS LAS LÁMINAS (12/11/2026, el analista:
 * «que las fotos de todos los jugadores que salen en las slides sean del
 * mismo tamaño»).
 *
 * Al enseñar, cada lámina acerca el campo a su jugada (de ×0,7 a ×1,4) y,
 * con el campo, crecían o menguaban las caras: en la J12 la falta directa
 * salía con las caras casi el doble que el córner. Ahora lo que se acerca es
 * el campo; las caras, las chapas, los rivales, nuestro portero y las letras
 * se pintan siempre a esta escala del lienzo de 1920 (la del campo entero al
 * editar), en la pizarra, el proyector, el PDF, el PowerPoint y el PDF de
 * cada jugador.
 */
export const CARA_EN_LAMINA = 0.78;

/** Lo que se escala lo pintado dentro del campo acercado `k` para verse a `CARA_EN_LAMINA`. */
export const escalaDeCaras = (k: number) => (k > 0 ? CARA_EN_LAMINA / k : 1);

/** Letra del nombre en la chapa, y el ancho que no se pasa (el resto se encoge). */
export const NOMBRE_CHAPA = 18;
export const CHAPA_MAX_W = 156;

/**
 * Lo que mide de ancho la chapa de una ficha. Es una estimación por letras
 * (mayúsculas seminegras con algo de espaciado): medir el DOM obligaría a
 * pintar dos veces.
 */
export function anchoChapa(nombre: string, sigla: string) {
  /*
  | Medido en Chrome con la Barlow Condensed de la pizarra (12/11/2026):
  | «CARVAJAL» ocupa 67 px a 18 px (0,47 por letra). Se cuenta 0,54 para
  | dejar margen si la letra tarda y se pinta con la de respaldo.
  */
  const texto = Math.max(nombre.length * NOMBRE_CHAPA * 0.54, sigla.length * 10);

  return Math.round(Math.min(CHAPA_MAX_W, Math.max(54, texto + 14)));
}

/** Lo que mide de ancho la placa con el apellido del rival (13 px, mayúsculas). */
export const anchoNombreRival = (nombre: string) => (nombre ? Math.round(nombre.length * 8.6 + 14) : 0);

/** Lo que mide la placa del nombre de nuestro portero (15 px, mayúsculas). */
export const anchoNombrePortero = (nombre: string) => (nombre ? Math.round(nombre.length * 10.6 + 14) : 0);

/** Lo que mide una letra de consigna en el campo («A», «C·D·E»). */
export const medidaLetra = (texto: string) => ({ w: Math.max(34, texto.length * 13 + 12), h: 34 });

/**
 * El dorsal de cada rival: el que no lo trae toma uno de su once probable —el
 * mismo que usa «Quién marca a quién»—, del más fuerte por arriba al menos y
 * sin repetir los que ya hay. El sacador del saque de banda no se adivina.
 */
export function rivalesConDorsal(todos: RivalPizarra[], suOnce: AtacantePanel[]): RivalPizarra[] {
  if (!suOnce.length) return todos;

  const usados = new Set(todos.map((uno) => String(uno.dorsal ?? "").trim()).filter(Boolean));
  const libres = suOnce.filter((uno) => !uno.portero && !usados.has(uno.dorsal));

  return todos.map((uno) => {
    if (String(uno.dorsal ?? "").trim() || uno.id.endsWith("sacador")) return uno;

    const suyo = libres.shift();

    return suyo ? { ...uno, dorsal: suyo.dorsal } : uno;
  });
}

/** El apellido de un rival por su dorsal (la «P», su portero). */
export function nombreDeRival(uno: RivalPizarra, suOnce: AtacantePanel[]) {
  const dorsal = String(uno.dorsal ?? "").trim();

  if (!suOnce.length || !dorsal) return "";
  if (/^p$/i.test(dorsal)) return suOnce.find((otro) => otro.portero)?.nombre ?? "";

  return suOnce.find((otro) => otro.dorsal === dorsal)?.nombre ?? "";
}

/* ------------------------------------------------------------------ */
/*  A QUIÉN SE PEGA CADA LETRA                                          */
/* ------------------------------------------------------------------ */

const plano = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const escapa = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const VACIAS = new Set(["en", "de", "la", "el", "los", "las", "a", "al", "del", "y", "si", "un", "una", "con", "por", "para", "se", "es", "no", "que", "lo", "le", "su", "sus"]);

const palabras = (texto: string) => plano(texto).split(/[^a-z0-9ñ]+/).filter(Boolean);

/** «barreras» ~ «barrera», «centrales» ~ «central», «marcar» ~ «marcas». */
function misma(a: string, b: string) {
  const n = Math.min(5, a.length, b.length);

  return n >= 4 && a.slice(0, n) === b.slice(0, n);
}

export type Ancla = { fichas: string[]; grupo: boolean };

/**
 * De quién habla cada consigna, para pintar su letra al lado (12/11/2026,
 * jueces: «A Cortas para 3x2», las A–G del córner defensivo y las A–B de la
 * falta directa no tenían letra en el campo).
 *
 * - Si nombra a alguien de la lámina, a él.
 * - Si no, por cómo empieza (las dos primeras palabras que dicen algo): un
 *   papel del panel («Centrales a marcar…» → los dos centrales de la barrera)
 *   o un grupo («Marcas: …», «En barreras…» → el grupo entero; con más de
 *   tres, una sola letra en el centro del grupo).
 * - Si no habla de nadie de la lámina, `null`: sale sin letra (con un punto)
 *   en la franja, para no prometer una letra que el campo no tiene.
 *
 * En las directas no hay letras: cada consigna es el orden de una zona y la
 * misma cara sale en varias.
 */
export function anclasDeConsignas(
  lineas: { tipo: string; texto: string }[],
  slide: SlidePizarra,
  fichas: FichaPizarra[],
  players: Map<string, Player>,
): (Ancla | null)[] {
  if (admiteRepetidos(slide)) return lineas.map(() => null);

  const grupos = gruposDe(slide);

  return lineas.map((linea) => {
    if (linea.tipo !== "consigna") return null;

    const texto = plano(linea.texto);
    const porNombre = fichas.filter((ficha) => {
      const player = players.get(ficha.playerId);
      const nombres = [player?.apodo, player?.nombre?.split(/\s+/)[0]].filter((n): n is string => !!n && n.trim().length >= 3);

      return nombres.some((nombre) => new RegExp(`(^|[^a-z0-9ñ])${escapa(plano(nombre))}([^a-z0-9ñ]|$)`).test(texto));
    });

    if (porNombre.length) return { fichas: porNombre.map((f) => f.id), grupo: porNombre.length > 3 };

    const cabeza = palabras(linea.texto.replace(/^\s*\d{1,2}\s*[.)-]\s*/, ""))
      .filter((p) => !VACIAS.has(p) && p.length >= 4 && !/^\d/.test(p))
      .slice(0, 2);

    for (const palabra of cabeza) {
      const porPapel = fichas.filter((ficha) => {
        const puesto = puestoDe(slide, ficha.puesto);

        /* Lo que ES (la primera palabra del papel, tras el «·»): «Corta» y «Barrera · central I» sí; «Bloqueo en corta», no. */
        const es = palabras((puesto?.label ?? "").split("·").pop() ?? "").find((p) => !VACIAS.has(p));

        return es ? misma(es, palabra) : false;
      });

      if (porPapel.length) return { fichas: porPapel.map((f) => f.id), grupo: porPapel.length > 3 };

      const grupo = grupos.find((g) => palabras(g.label).some((p) => misma(p, palabra)));
      const delGrupo = grupo ? fichas.filter((ficha) => puestoDe(slide, ficha.puesto)?.grupo === grupo.key) : [];

      if (delGrupo.length) return { fichas: delGrupo.map((f) => f.id), grupo: delGrupo.length > 3 };
    }

    return null;
  });
}


/* ------------------------------------------------------------------ */
/*  TODO A LA VEZ                                                      */
/* ------------------------------------------------------------------ */

export type LetraEnCampo = { id: string; texto: string; left: number; top: number; w: number; h: number };

export type LaminaColocada = {
  separadas: Separadas;
  apartados: Apartados;
  ladoPortero: LadoNombre;
  cajasPortero: Caja[];
  letras: LetraEnCampo[];
};

/**
 * Nuestro portero al enseñar. Con `chapa` (el ancho de su chapa «POR» con el
 * nombre) va con su foto entera, como una ficha más; sin ella, el disco «POR».
 */
export type PorteroAColocar = { x: number; y: number; nombre: number; chapa?: number };

export type EntradaLamina = {
  fichas: (FichaPizarra & { chapa: number })[];
  rivales: (RivalPizarra & { chapa: number })[];
  portero: PorteroAColocar | null;
  letras: { letra: string; ancla: Ancla }[];
  /**
   * A qué escala se pintan las caras, chapas, rivales y letras respecto a la
   * plantilla (`escalaDeCaras`): con el campo acercado, menos de 1.
   */
  escala?: number;
};

const aEscala = <T extends { x: number; y: number }>(p: T, e: number): T => ({ ...p, x: p.x / e, y: p.y / e });
const cajaPor = (c: Caja, e: number): Caja => ({ x0: c.x0 * e, x1: c.x1 * e, y0: c.y0 * e, y1: c.y1 * e });

/**
 * Coloca todo lo que se pinta al enseñar: nuestras caras (sin pisar el nombre
 * de nuestro portero), los rivales con su apellido y las letras de las
 * consignas, cada cosa sin tapar ningún nombre de lo ya colocado.
 *
 * `letras`: la letra (o letras, «C·D») de cada ancla. Las de una ficha suelta
 * van junto a ella; las de un grupo, en su centro.
 *
 * Con `escala` < 1 todo lo pintado mide menos en la plantilla: se coloca en
 * la plantilla vista a esa escala (las posiciones divididas por ella) y se
 * devuelve en la de siempre. Así las medidas de `separa.ts` siguen siendo
 * las de una cara a su tamaño.
 */
export function colocaLamina(entrada: EntradaLamina): LaminaColocada {
  const e = entrada.escala && entrada.escala > 0 ? entrada.escala : 1;
  const fichas = entrada.fichas.map((ficha) => aEscala(ficha, e));
  const rivales = entrada.rivales.map((uno) => aEscala(uno, e));
  const portero = entrada.portero ? aEscala(entrada.portero, e) : null;
  const lienzo = lienzoA(e);

  const conFigura = Boolean(portero?.chapa);
  const ladoPortero: LadoNombre = portero && !conFigura ? ladoNombrePortero(portero, fichas) : "abajo";
  const delPortero = portero
    ? conFigura
      ? cajasPorteroFigura(portero.x, portero.y, portero.chapa ?? 0)
      : cajasPortero(portero.x, portero.y, portero.nombre, ladoPortero)
    : [];
  const separadas = separaFichas(fichas, delPortero);
  const apartados = apartaRivales(rivales, fichas, separadas, delPortero, lienzo);

  /* Las letras de cada ficha suelta se juntan («C·D·E»); las de grupo, por grupo. */
  const porFicha = new Map<string, string[]>();
  const porGrupo = new Map<string, { letras: string[]; fichas: string[] }>();

  /*
  | Dos o tres que están juntos («Centrales a marcar…»: Joan y Mario, hombro
  | con hombro en la barrera) llevan UNA letra encima de los dos: con una por
  | cabeza, en una fila apretada la de Joan acababa junto a Fortea.
  */
  const juntos = (ids: string[]) => {
    const suyas = fichas.filter((ficha) => ids.includes(ficha.id));

    if (suyas.length < 2) return false;

    const xs = suyas.map((ficha) => ficha.x);
    const ys = suyas.map((ficha) => ficha.y);

    return Math.max(...xs) - Math.min(...xs) <= 260 && Math.max(...ys) - Math.min(...ys) <= 120;
  };

  for (const { letra, ancla } of entrada.letras) {
    if (ancla.grupo || juntos(ancla.fichas)) {
      const clave = `grupo:${[...ancla.fichas].sort().join(",")}`;
      const una = porGrupo.get(clave) ?? { letras: [], fichas: ancla.fichas };

      una.letras.push(letra);
      porGrupo.set(clave, una);
    } else {
      for (const id of ancla.fichas) porFicha.set(id, [...(porFicha.get(id) ?? []), letra]);
    }
  }

  const insignias = [
    ...fichas.flatMap((ficha) => {
      const suyas = porFicha.get(ficha.id);

      if (!suyas?.length) return [];

      const texto = suyas.join("·");

      return [{ id: ficha.id, texto, x: separadas.get(ficha.id)?.x ?? ficha.x, y: ficha.y, k: 1, ...medidaLetra(texto) }];
    }),
    ...[...porGrupo].flatMap(([clave, grupo]) => {
      const suyas = fichas.filter((ficha) => grupo.fichas.includes(ficha.id));

      if (!suyas.length) return [];

      const xs = suyas.map((ficha) => separadas.get(ficha.id)?.x ?? ficha.x);
      const texto = grupo.letras.join("·");

      return [
        {
          id: clave,
          texto,
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: Math.min(...suyas.map((ficha) => ficha.y)),
          k: 1,
          grupo: true,
          ...medidaLetra(texto),
        },
      ];
    }),
  ];

  const sitios = colocaInsignias(
    insignias,
    fichas,
    separadas,
    rivales.map((uno) => ({ ...uno, ...(apartados.get(uno.id) ?? {}) })),
    delPortero,
    lienzo,
  );

  /* De vuelta a la plantilla de siempre. */
  return {
    separadas: new Map([...separadas].map(([id, sep]) => [id, { x: sep.x * e }])),
    apartados: new Map([...apartados].map(([id, a]) => [id, { ...a, x: a.x * e, y: a.y * e }])),
    ladoPortero,
    cajasPortero: delPortero.map((c) => cajaPor(c, e)),
    letras: insignias.map((una) => ({
      id: una.id,
      texto: una.texto,
      w: una.w * e,
      h: una.h * e,
      left: (sitios.get(una.id)?.left ?? una.x) * e,
      top: (sitios.get(una.id)?.top ?? una.y) * e,
    })),
  };
}

/**
 * Lo que queda tapado en una lámina ya colocada (`solapesDeLamina`, a la
 * escala a la que se pintó). Para el arnés que valida las láminas.
 */
export function solapesDeColocada(entrada: EntradaLamina, colocada: LaminaColocada, nombre?: (id: string) => string): string[] {
  const e = entrada.escala && entrada.escala > 0 ? entrada.escala : 1;

  return solapesDeLamina({
    fichas: entrada.fichas.map((ficha) => aEscala(ficha, e)),
    separadas: new Map([...colocada.separadas].map(([id, sep]) => [id, { x: sep.x / e }])),
    rivales: entrada.rivales.map((uno) => aEscala({ ...uno, ...(colocada.apartados.get(uno.id) ?? {}) }, e)),
    portero: colocada.cajasPortero.map((c) => cajaPor(c, 1 / e)),
    letras: colocada.letras.map((l) => ({ id: l.texto, caja: { x0: l.left / e, x1: (l.left + l.w) / e, y0: l.top / e, y1: (l.top + l.h) / e } })),
    nombre,
  });
}
