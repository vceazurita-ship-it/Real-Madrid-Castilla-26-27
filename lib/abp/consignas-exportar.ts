/**
 * LAS CONSIGNAS QUE SALEN EN LO EXPORTADO (12/11/2026).
 *
 * Los jueces de los exportables de la pizarra (fútbol, análisis y marketing)
 * pidieron dos cosas de la franja de consignas:
 *
 * - Que cada variante diga lo suyo. En la J12 las tres láminas de córner
 *   ofensivo llevaban las mismas consignas A–E copiadas (y la D, «Cestero saca
 *   a corta», contradecía la lámina: allí Cestero es el rechace largo).
 * - Que no salgan consignas que no dicen qué hacer ni a quién: «Orden de
 *   lanzamiento cerrado antes del partido» o «Despeje expeditivo con la pierna
 *   corta».
 *
 * Lo guardado NO se toca (el analista sigue viendo y editando sus consignas, y
 * el menú «Exportar» le avisa de lo copiado y de lo que contradice la lámina).
 * Sólo lo exportado —PDF general, PowerPoint y PDF de cada jugador— cambia:
 * una variante con las consignas copiadas de otra anterior, o una consigna
 * genérica, sale con las que se leen de SU lámina: quién hace qué y dónde, de
 * sus puestos, sus flechas y sus marcas. Si la lámina no da para una consigna
 * concreta, la genérica no sale y no se pone otra (regla «informes sin huecos»).
 *
 * Tercera ronda (12/11/2026): tampoco sale una consigna que contradice la
 * lámina («parejas de bloqueo Joan-Mario» con Joan de rematador): se cambia,
 * en su sitio, por las que se leen de la lámina (`contradiceLaLamina`).
 */

import {
  admiteRepetidos,
  gruposDe,
  lineasConsignas,
  ocupantesDeGrupo,
  puestoDe,
  puestosDeGrupo,
  tituloVisible,
  type SlidePizarra,
  type TableroPizarra,
} from "@/lib/abp/pizarra";
import { cometidosDe, nombreCorto } from "@/lib/abp/pizarra-jugador";
import type { Player } from "@/types/player";

const plano = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Las consignas que no dicen qué hacer ni a quién (las que señalaron los jueces). */
const GENERICAS = [/^orden de lanzamiento cerrado/, /^despeje expeditivo/];

export const esGenerica = (texto: string) => GENERICAS.some((patron) => patron.test(plano(texto).replace(/^\d+[.)]\s*/, "")));

/** Cuántas consignas propias de la lámina, como mucho (las que se leen bien en la sala). */
const MAX_PROPIAS = 4;

const minuscula = (texto: string) => texto.charAt(0).toLocaleLowerCase("es-ES") + texto.slice(1);

const lista = (partes: string[]) =>
  partes.length < 2 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

/**
 * Las consignas que se leen de la propia lámina: quién hace qué y dónde.
 *
 * - Con flechas, la tarea por pasos de cada uno (la misma del PDF de cada
 *   jugador): «Joan: sales del 2.º palo y atacas el punto de penalti».
 * - Sin flechas, por grupos del panel: el orden de lanzadores de cada zona
 *   («Penalti: 1.º Sergio, 2.º Pol»), las marcas con su dorsal («Marcas:
 *   Sergio al 8, Joan al 4») y el resto con su puesto («Frontal: Pol, rechace
 *   corto; Leiva, rechace largo»).
 */
export function consignasDeLaLamina(slide: SlidePizarra, players: Map<string, Player>): string[] {
  const nombre = (playerId: string) => nombreCorto(players.get(playerId));

  if ((slide.trazos ?? []).length) {
    const solo: TableroPizarra = { partidoId: "", rival: "", slides: [slide] } as unknown as TableroPizarra;
    const vistos = new Set<string>();
    const tareas = slide.fichas.flatMap((ficha) => {
      if (vistos.has(ficha.playerId)) return [];

      vistos.add(ficha.playerId);

      const accion = cometidosDe(solo, ficha.playerId, players)[0];
      const tarea = (accion?.tarea ?? "")
        .split(/\s*·\s*/)
        .filter((paso) => paso && !/^arrancas en la fase/i.test(paso));
      const quien = nombre(ficha.playerId);

      if (!quien || tarea.length === 0) return [];

      const fase = Math.min(...(slide.trazos ?? []).filter((t) => Math.hypot(t.x1 - ficha.x, t.y1 - ficha.y) <= 40).map((t) => t.fase), 99);

      return [{ fase, texto: `${quien}: ${minuscula(lista(tarea.map(minuscula)))}` }];
    });

    if (tareas.length) {
      return tareas
        .sort((a, b) => a.fase - b.fase)
        .slice(0, MAX_PROPIAS)
        .map((una) => una.texto);
    }
  }

  return gruposDe(slide)
    .flatMap((grupo) => {
      const puestos = puestosDeGrupo(slide, grupo.key);
      const ocupantes = ocupantesDeGrupo(slide, grupo.key);

      if (!ocupantes.length) return [];

      const rotulo = `${grupo.label.charAt(0).toLocaleUpperCase("es-ES")}${grupo.label.slice(1).toLocaleLowerCase("es-ES")}`
        .replace(/ i$/, " izquierda")
        .replace(/ d$/, " derecha");

      /*
      | Los lanzadores (las directas, o los puestos sin sitio en el campo): el
      | orden de cada zona, que es lo que la consigna genérica no decía
      | («Penalti: 1.º Pol, 2.º Leiva, 3.º Carvajal»).
      */
      if (admiteRepetidos(slide) || puestos.every((puesto) => puesto.x == null)) {
        const nombres = ocupantes.map(nombre).filter(Boolean);

        return nombres.length ? [`${rotulo}: ${nombres.map((n, i) => (nombres.length > 1 ? `${i + 1}.º ${n}` : n)).join(", ")}`] : [];
      }

      /* «Rematador 1, 2, 3» bajo «Rematadores»: el número no dice nada más que el panel; los nombres en su orden. */
      const mismaRaiz = (papel: string) => {
        const m = /^(\S+)\s+\d+$/.exec(plano(papel));

        return Boolean(m && m[1].slice(0, 5) === plano(grupo.label).slice(0, 5));
      };

      const partes = slide.fichas
        .filter((ficha) => ficha.puesto && puestoDe(slide, ficha.puesto)?.grupo === grupo.key)
        .flatMap((ficha) => {
          const quien = nombre(ficha.playerId);
          const puesto = puestoDe(slide, ficha.puesto);
          const dorsal = ficha.puesto ? String(slide.marcas?.[ficha.puesto] ?? "").trim() : "";

          if (!quien || !puesto) return [];
          if (dorsal) return [`${quien} al ${dorsal}`];
          if (mismaRaiz(puesto.label)) return [quien];

          const papel = minuscula(puesto.label.replace(/\s*·\s*\d+$/, "").trim());

          /* «Marca 3» o un papel igual que el grupo no dice nada más que el panel. */
          if (!papel || plano(papel) === plano(grupo.label) || /^marca\b/.test(plano(papel))) return [];

          return [`${quien}, ${papel}`];
        });

      return partes.length ? [`${rotulo}: ${partes.some((parte) => parte.includes(",")) ? partes.join("; ") : lista(partes)}`] : [];
    })
    .slice(0, MAX_PROPIAS);
}

/** La clave de las consignas de una lámina, para ver si es copia de otra. */
function claveConsignas(slide: SlidePizarra) {
  const lineas = lineasConsignas(slide.notas).filter((linea) => linea.tipo === "consigna");

  return lineas.length < 2 ? "" : `${slide.plantilla}|${lineas.map((linea) => plano(linea.texto)).join("|")}`;
}

/**
 * El tablero tal y como se exporta: las variantes copiadas y las consignas
 * genéricas, cambiadas por las de su lámina. Devuelve el mismo objeto si no
 * hay nada que cambiar (las huellas de la caché de exportación no se mueven).
 */
export function consignasParaExportar(tablero: TableroPizarra, players: Map<string, Player>): TableroPizarra {
  const vistas = new Set<string>();
  const todos = [...players.values()];
  let cambio = false;

  const slides = tablero.slides.map((slide) => {
    const clave = claveConsignas(slide);
    const copiada = Boolean(clave) && vistas.has(clave);

    if (clave) vistas.add(clave);

    const genericas = slide.notas.filter((nota) => nota.trim() && esGenerica(nota));
    /*
    | 12/11/2026, tercera ronda de jueces: «Rematadores: parejas de bloqueo
    | Joan-Mario + Dani-Cestero» con Joan de rematador y Dani de zaguero, y
    | «Cestero saca a corta» con Cestero de rechace largo. Lo exportado no
    | puede contradecir la lámina: esas consignas salen cambiadas por las que
    | se leen de la lámina, en su mismo sitio. Lo guardado sigue igual (y el
    | menú «Exportar» se lo avisa al analista).
    */
    const contradichas = new Set(slide.notas.filter((nota) => contradiceLaLamina(nota, slide, todos)));

    if (!copiada && genericas.length === 0 && contradichas.size === 0) return slide;

    const propias = consignasDeLaLamina(slide, players);
    const nuevas = propias.filter((una) => !slide.notas.some((nota) => plano(nota) === plano(una)));
    const notas = copiada
      ? propias
      : contradichas.size === 0
        ? slide.notas.flatMap((nota) => (esGenerica(nota) ? [] : [nota])).concat(nuevas)
        : (() => {
            const salen: string[] = [];
            const cuantas = Math.min(nuevas.length, contradichas.size + 1);
            let puestas = false;

            for (const nota of slide.notas) {
              if (esGenerica(nota)) continue;

              if (contradichas.has(nota)) {
                if (!puestas) salen.push(...nuevas.slice(0, cuantas));
                puestas = true;
                continue;
              }

              salen.push(nota);
            }

            return salen;
          })();

    cambio = true;

    return { ...slide, notas };
  });

  if (!cambio) return tablero;

  /*
  | El título visible sale de la primera consigna cuando dos láminas se llaman
  | igual («CÓRNER OFENSIVO · Cortas para 3x2») o, si esa pista se repite, del
  | número de variante. Con las consignas cambiadas la pista cambiaría
  | («CÓRNER OFENSIVO · Pol»): las que se llaman igual se quedan con el título
  | que tenían con las consignas del analista.
  */
  const repetidos = (i: number) =>
    tablero.slides.some((otra, j) => j !== i && otra.titulo.trim().toLowerCase() === tablero.slides[i].titulo.trim().toLowerCase());

  return {
    ...tablero,
    slides: slides.map((slide, i) => (repetidos(i) ? { ...slide, titulo: tituloVisible(tablero.slides, i) } : slide)),
  };
}

/* ------------------------------------------------------------------ */
/*  AVISO: UNA CONSIGNA QUE NOMBRA A ALGUIEN CON OTRO PAPEL            */
/* ------------------------------------------------------------------ */

/** Lo que dice la consigna que hace alguien, y lo que tendría que decir su puesto. */
const PAPELES: { dice: RegExp; puesto: RegExp; nombre: string }[] = [
  { dice: /\bsaca(r|dor)?\b/, puesto: /saque|sacador|corta|direct/, nombre: "saca" },
  { dice: /\bbloque/, puesto: /bloque/, nombre: "bloquea" },
  { dice: /\brechace/, puesto: /rechace/, nombre: "rechace" },
];

/**
 * Las consignas que nombran a uno de la lámina con un papel que no es el suyo
 * (12/11/2026, jueces: «Cestero saca a corta» con Cestero de rechace largo).
 * Sólo cuando la frase lo dice de UNO solo: con dos nombres no se sabe a quién
 * va cada verbo y mejor no avisar en falso.
 */
type EnLamina = { nombres: string[]; papel: string; visible: string; label: string };

function enLaLamina(slide: SlidePizarra, players: { id: string; nombre?: string; apodo?: string }[]): EnLamina[] {
  return slide.fichas.flatMap((ficha) => {
    const player = players.find((p) => p.id === ficha.playerId);
    const puesto = puestoDe(slide, ficha.puesto);
    const grupo = puesto ? gruposDe(slide).find((g) => g.key === puesto.grupo)?.label ?? "" : "";
    const nombres = [player?.apodo, player?.nombre?.split(/\s+/)[0]].map((n) => plano(n ?? "")).filter((n) => n.length >= 3);

    return puesto && nombres.length ? [{ nombres, papel: plano(`${puesto.label} ${grupo}`), visible: (player?.apodo || player?.nombre || "").trim(), label: puesto.label }] : [];
  });
}

const escapa = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Lo que una consigna dice de alguien que contradice su papel en la lámina.
 *
 * Por frases («+», «;» o punto). En cada una, el verbo del papel («saca»,
 * «bloqueo», «rechace») va con el nombre que tiene más cerca: «parejas de
 * bloqueo Joan-Mario» le da el bloqueo a Joan (rematador 1 en la lámina) y
 * «Cestero saca a corta», el saque a Cestero (rechace largo). 12/11/2026,
 * tercera ronda: con dos nombres en la frase antes no se avisaba.
 */
function contradicciones(texto: string, enLamina: EnLamina[]): string[] {
  const avisos: string[] = [];

  for (const frase of texto.split(/\s*(?:\+|;|\.\s)\s*/)) {
    const llano = plano(frase);
    const papel = PAPELES.find((p) => p.dice.test(llano));

    if (!papel) continue;

    const donde = llano.search(papel.dice);
    const nombrados = enLamina.flatMap((uno) =>
      uno.nombres.flatMap((n) => {
        const m = new RegExp(`(^|[^a-z0-9ñ])${escapa(n)}([^a-z0-9ñ]|$)`).exec(llano);

        return m ? [{ uno, d: Math.abs(m.index + m[1].length - donde) }] : [];
      }),
    );

    if (nombrados.length === 0) continue;

    const { uno } = nombrados.sort((a, b) => a.d - b.d)[0];

    if (!papel.puesto.test(uno.papel)) avisos.push(`«${frase.trim()}»: ${uno.visible} es «${uno.label}» en esta lámina`);
  }

  return avisos;
}

export function consignasConOtroPapel(slide: SlidePizarra, players: { id: string; nombre?: string; apodo?: string }[]): string[] {
  const enLamina = enLaLamina(slide, players);

  return [
    ...new Set(
      lineasConsignas(slide.notas)
        .filter((linea) => linea.tipo === "consigna")
        .flatMap((linea) => contradicciones(linea.texto, enLamina)),
    ),
  ];
}

/** ¿Esta consigna da a alguien un papel que no tiene en la lámina? */
export function contradiceLaLamina(nota: string, slide: SlidePizarra, players: { id: string; nombre?: string; apodo?: string }[]) {
  const texto = nota.trim();

  return Boolean(texto) && !texto.endsWith(":") && contradicciones(texto, enLaLamina(slide, players)).length > 0;
}
