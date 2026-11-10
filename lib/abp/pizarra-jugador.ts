/**
 * La pizarra de balón parado de UN jugador, en PDF para el móvil (26/10/2026).
 *
 * Sale de `/abp-pizarra`: un PDF por cada jugador del tablero para mandárselo
 * por WhatsApp antes del partido —en el autobús, en el vestuario—. Por eso va
 * en VERTICAL (9:16, lo que ocupa la pantalla de un teléfono) y no en la
 * diapositiva apaisada de la sala.
 *
 * Desde el 01/11/2026, «mucha menos paja»:
 * - Sin portada. Con dos acciones o más, la primera hoja es el resumen: una
 *   fila por acción con su sigla, su puesto y a quién marca.
 * - Una hoja por acción: cabecera mínima (escudo, dorsal, nombre, jornada y
 *   «acción 2 de 5»), el campo ENCUADRADO en lo suyo (sus fichas, sus flechas
 *   y su hombre) con él en foco, el resto en penumbra y el aro «TÚ», y debajo
 *   DÓNDE (sigla y puesto, a quién marca), QUÉ HACE por fases y con quién,
 *   PARA QUÉ, y en chapas la señal, lo que le toca y lo que viene después si
 *   está dibujado.
 *
 * Segunda vuelta de los expertos (01/11/2026): arriba y en grande lo que HACE
 * (su tarea por pasos, o «Marcas al 4 Pérez (1,86 m)» en las defensivas) con
 * su sigla y su puesto en pequeño encima; el recorte se mide en la foto real
 * (la pizarra acerca el campo a la jugada) y deja enteros a él y a los de su
 * zona; la jornada, el rival y la fecha bajan a un pie mínimo con «1 / 9».
 *
 * Lenguaje de `INDIVIDUAL.pptx` (papel blanco, Barlow Condensed, chapas de
 * `lib/rivals/lienzo-club.ts`). Lo que no tiene contenido no se nombra.
 */

import type { Player } from "@/types/player";
import {
  CABECERA_H as CABECERA_SLIDE,
  LADO_PIZARRA_LABEL,
  PLANTILLA_BY_KEY,
  TABLERO_H,
  TABLERO_W,
  adornosDe,
  gruposDe,
  jugadoresDelTablero,
  lineasConsignas,
  normalizaConsigna,
  puestoDe,
  siglaDe,
  tituloVisible,
  type LadoPizarra,
  type LineaConsigna,
  type TableroPizarra,
  type VistaCampo,
} from "@/lib/abp/pizarra";
import type { TipoTrazo, TrazoPizarra } from "@/lib/abp/trazos";
import { aLienzo, aMetros } from "@/lib/abp-lab/puente-pizarra";
import {
  C,
  ajusta,
  anchoEspaciado,
  cargaImagen,
  chapa,
  encaja,
  fuente,
  rectRedondo,
  textoEspaciado,
  type Ctx,
} from "@/lib/rivals/lienzo-club";

/**
 * La hoja: 1080 de ancho (540 pt en el PDF). El vídeo usa 1080×1920; las hojas
 * del PDF miden de alto lo que su contenido.
 */
export const HOJA_W = 1080;
export const HOJA_H = 1920;

const MARGEN = 64;

/* ------------------------------------------------------------------ */
/*  LOS DATOS                                                          */
/* ------------------------------------------------------------------ */

export type CometidoAccion = {
  /** Índice de la diapositiva en el tablero (para fotografiarla). */
  indice: number;
  titulo: string;
  lado: LadoPizarra;
  /** Sus puestos en la acción: casi siempre uno; en directas, varios. */
  puestos: { sigla: string; label: string; grupo: string }[];
  /**
   * Su misión en una línea: qué hace (de sus flechas), con quién y para qué
   * (la intención). Vacía si no hay nada de eso: el puesto ya lo dice.
   */
  mision: string;
  /** La señal de la jugada, sólo en las ofensivas. */
  senal: string;
  /** Las consignas que le tocan a él (máximo 2), sin el «X:» de su grupo. */
  consignas: string[];
  /** El rival dibujado a su lado: «Marcas al 4» / «Te vigila el 4». */
  rival: string;
  /** Lo que viene después: la flecha de transición de las defensivas. */
  despues: string;
  /**
   * Lo que el PDF necesita por separado (01/11/2026): sus flechas por fase,
   * con quién y para qué, y dónde mirar en el campo para encuadrarle.
   */
  pasos: { fase: number; verbo: string }[];
  /** Lo que hace en cada fase, con su sitio: «Atacas el 1.er palo» (una por fase, la primera flecha). */
  pasosFase: { fase: number; texto: string }[];
  con: string[];
  para: string;
  /** Sus fichas, sus flechas y el rival que marca, en coordenadas de la diapositiva. */
  foco: { x: number; y: number }[];
  /** Dónde está el rival que marca, si está dibujado. */
  marcaPunto: { x: number; y: number } | null;
  /** `despues` sale de una flecha dibujada (no del recordatorio por su papel). */
  despuesDibujado: boolean;
  /**
   * Su tarea por pasos, de sus flechas (01/11/2026, expertos): «Sales del
   * 2.º palo · arrancas en la fase 2 · atacas el punto de penalti». Vacía si
   * no tiene flechas.
   */
  tarea: string;
  /** El dorsal del rival que marca («Quién marca a quién» o, en defensivas, el dibujado más cerca). */
  marcaDorsal: string;
  /** Dónde están sus compañeros de zona (su grupo): el recorte del PDF los deja dentro. */
  zona: { x: number; y: number }[];
  /** Los demás de la diapositiva: la chapa «TÚ» busca el hueco donde no tape a nadie. */
  otros: { x: number; y: number }[];
  /** El portero no tiene ficha en las diapositivas: su hoja va sin aro y encuadrada en la portería. */
  sinFicha?: boolean;
};

/*
| EL PORTERO TAMBIÉN TIENE SU PDF (06/11/2026, expertos)
|
| Las plantillas de la pizarra dibujan a los diez de campo: salían 10 PDF y el
| portero se quedaba sin el suyo. Sale de las consignas que le nombran
| («Portero lidera la atención al 1 + 2») y, en las defensivas, de lo que le
| toca siempre a un portero en esa acción. Las ofensivas iguales, una vez.
*/
const PORTERO = /portero|^por\b|guardameta|^gk\b/i;

export const esPortero = (player: Player | undefined) => Boolean(player && PORTERO.test(player.posicion ?? ""));

const TAREA_PORTERO: Record<string, string> = {
  "corner-def": "Mandas en el área pequeña: sales a por todo balón que puedas atacar",
  "falta-lat-def": "Ordenas la línea y sales a por lo que caiga entre la línea y tú",
  "falta-dir-def": "Colocas la barrera y te quedas en tu palo: ves salir el balón",
  "banda-def": "Hablas a la línea: avisas de la carrera libre y sales al balón al área",
};

function accionDelPortero(tablero: TableroPizarra, indice: number): CometidoAccion[] {
  const slide = tablero.slides[indice];
  const lado = PLANTILLA_BY_KEY.get(slide.plantilla)?.lado ?? "ofensivo";
  const suyas = lineasConsignas(slide.notas)
    .filter((linea) => linea.tipo === "consigna" && /(^|[^a-z])portero([^a-z]|$)/.test(plano(linea.texto)))
    .map((linea) => normalizaConsigna(linea.texto.replace(/^portero\s*:\s*/i, "")))
    .map((texto) => texto.charAt(0).toLocaleUpperCase("es-ES") + texto.slice(1).replace(/\bAtención\b/g, "atención"));

  if (lado === "ofensivo" && suyas.length === 0) return [];

  const tarea = lado === "defensivo" ? (TAREA_PORTERO[slide.plantilla] ?? "Mandas en tu área: hablas y ordenas a la línea") : "Ordenas el equilibrio atrás: hablas a los que se quedan";
  const enLienzo = (x: number, y: number) => aLienzo(slide.vista, { x, y });
  const porteria = [enLienzo(30.3, 0), enLienzo(37.7, 0), enLienzo(34, 5.5)].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const balon = (slide.trazos ?? []).filter((t) => t.tipo === "balon").flatMap((t) => [{ x: t.x2, y: t.y2 }]);

  return [
    {
      indice,
      titulo: tituloVisible(tablero.slides, indice),
      lado,
      puestos: [{ sigla: "POR", label: "Portero", grupo: "Portería" }],
      mision: "",
      senal: "",
      consignas: suyas.slice(0, MAX_CONSIGNAS),
      rival: "",
      despues: "",
      pasos: [],
      pasosFase: [],
      con: [],
      para: "",
      foco: [...porteria, ...balon],
      marcaPunto: null,
      despuesDibujado: false,
      tarea,
      marcaDorsal: "",
      /* Sin ficha suya, el encuadre abarca a todos: se cortaban compañeros (segunda ronda). */
      zona: slide.fichas.filter((f) => f.x >= 0 && f.y >= 0).map((f) => ({ x: f.x, y: f.y })),
      otros: slide.fichas.filter((f) => f.x >= 0 && f.y >= 0).map((f) => ({ x: f.x, y: f.y })),
      sinFicha: true,
    },
  ];
}

/** Los del tablero y, si no está dibujado, el portero del once: los PDF que salen. */
export function filasParaPdf(tablero: TableroPizarra, players: Map<string, Player>, portero?: string) {
  const filas = jugadoresDelTablero(tablero).map((fila) => ({ ...fila, sinFichas: false }));

  if (portero && !filas.some((fila) => fila.playerId === portero) && cometidosDe(tablero, portero, players).length > 0) {
    filas.push({ playerId: portero, slides: 0, fichas: 0, sinFichas: true });
  }

  return filas;
}

/*
| Lo que hace en una defensiva cuando no tiene marca ni flechas (06/11/2026,
| expertos): salía «Marca (3.º)» o «Balón», el rol sin verbo.
*/
function verboDefensivo(puestos: { label: string }[]) {
  const l = plano(puestos[0]?.label ?? "").trim();
  const n = l.match(/(\d+)$/)?.[1];

  if (/^marca/.test(l)) return `Marcas en la línea${n ? ` (puesto ${n})` : ""}: atacas el balón antes que tu hombre`;
  if (/^balon$/.test(l)) return "Atacas el primer balón: despejas lo que caiga en tu zona";
  if (/juego en corto/.test(l)) return "Sales al juego en corto: que no la reciban cómodos";
  if (/^corta/.test(l)) return "Defiendes la corta: ganas el primer contacto";
  if (/^area$/.test(l)) return "Cierras el área: atacas lo que caiga dentro";
  if (/rechace corto/.test(l)) return "Atacas el rechace corto en la frontal";
  if (/rechace largo/.test(l)) return "Vigilas el rechace largo y la segunda jugada";
  if (/^rechace/.test(l)) return "Atacas el rechace";
  if (/barrera.*punta/.test(l)) return "Cierras la barrera en la punta: tapas el palo";
  if (/^barrera/.test(l)) {
    const sitio = (l.split("·")[1] ?? "").trim().replace(/ i$/, " izquierda").replace(/ d$/, " derecha");
    return `Formas la barrera${sitio ? ` (${sitio})` : ""}: saltáis a la vez, nadie se gira`;
  }
  if (/^suelo$/.test(l)) return "Te tumbas tras la barrera: tapas el disparo raso";
  if (/2.? jugada/.test(l)) return "Atacas la segunda jugada: el balón que salga de la barrera";
  if (/al sacador/.test(l)) return "Presionas al sacador: que no saque cómodo";
  if (/defensa de banda/.test(l)) return "Defiendes la banda: sales al que recibe el saque";
  if (/zaguero|equilibr/.test(l)) return "Te quedas atrás: cierras la contra";

  return "";
}

/**
 * Los nombres de los nuestros con su mayúscula en las consignas (06/11/2026,
 * expertos): «sacador aguado» → «sacador Aguado».
 */
function conNombres(texto: string, players: Map<string, Player>) {
  const nombres = new Map<string, string>();

  for (const p of players.values()) {
    const corto = nombreCorto(p);
    if (corto.length >= 3 && !/\s/.test(corto)) nombres.set(plano(corto), corto.charAt(0).toLocaleUpperCase("es-ES") + corto.slice(1).toLocaleLowerCase("es-ES"));
  }

  return texto.replace(/(?<!\p{L})\p{L}{3,}(?!\p{L})/gu, (palabra) => nombres.get(plano(palabra)) ?? palabra);
}

/** A cuánto de su ficha un rival dibujado es «el suyo». */
const CERCA_RIVAL = 170;

/** Lo que hace, por el tipo de su flecha. */
const VERBO: Record<LadoPizarra, Record<TipoTrazo, string>> = {
  ofensivo: { carrera: "Atacas", bloqueo: "Bloqueas", balon: "Sacas" },
  defensivo: { carrera: "Sales", bloqueo: "Bloqueas", balon: "Despejas" },
};

/** Un trazo es suyo si arranca a sus pies (igual que lo ata la pizarra). */
const PIES = 40;

/** Consignas que caben en la hoja sin encoger la letra. */
const MAX_CONSIGNAS = 2;

export const nombreCorto = (player: Player | undefined) =>
  (player?.apodo || player?.nombre || "").trim();

const plano = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const conPalabra = (texto: string, palabra: string) =>
  palabra.length > 1 &&
  new RegExp(`(^|[^a-z0-9])${palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(texto);

/** «a, b y c». */
const lista = (nombres: string[]) =>
  nombres.length < 2 ? nombres.join("") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;

/**
 * Las consignas que le tocan (criterio del cuerpo técnico, 26/10/2026): las que
 * cuelgan de un rótulo «X:» —subtítulo o prefijo— que nombra su grupo o su
 * puesto, y las que nombran su puesto, su nombre o su sigla (de dos letras o
 * más: una «C» suelta da falsos positivos). Si no le toca ninguna, la primera
 * consigna colectiva, la que no es de ningún grupo.
 */
function consignasSuyas(
  lineas: LineaConsigna[],
  claves: string[],
  siglas: string[],
): string[] {
  let rotulo = "";

  const todas = lineas.flatMap((linea) => {
    if (linea.tipo === "subtitulo") {
      rotulo = plano(linea.texto);

      return [];
    }

    if (linea.tipo !== "consigna") return [];

    const prefijo = /^([^:]{2,30}):\s*(.+)$/.exec(linea.texto);
    const deQuien = prefijo ? plano(prefijo[1]) : rotulo;
    const cuerpo = (prefijo ? prefijo[2] : linea.texto).replace(/^\d+[.)]\s*/, "");
    const texto = plano(linea.texto);

    const suya =
      claves.some((clave) => (deQuien && conPalabra(deQuien, clave)) || conPalabra(texto, clave)) ||
      siglas.some((sigla) => new RegExp(`(^|[^A-ZÑ])${sigla}([^A-ZÑ]|$)`).test(linea.texto));

    return [{ suya, colectiva: !deQuien, cuerpo: cuerpo.charAt(0).toLocaleUpperCase("es-ES") + cuerpo.slice(1) }];
  });

  const suyas = todas.filter((c) => c.suya);
  const elegidas = suyas.length ? suyas : todas.filter((c) => c.colectiva).slice(0, 1);

  return elegidas.slice(0, MAX_CONSIGNAS).map((c) => c.cuerpo);
}

/* ------------------------- su tarea por pasos ------------------------- */

/**
 * El nombre de un sitio del campo, con su artículo («el 2.º palo», «la
 * frontal»), a partir de la foto (metros del laboratorio: `x` de banda a
 * banda, `y` desde la línea de gol). `ladoBalon` es de qué banda llega el
 * balón (−1, 1, o 0 si no se sabe): con él, el palo cercano es el primero.
 * Lo que no tiene un nombre claro devuelve "" y el paso va sin sitio.
 */
export function nombreDeSitio(vista: VistaCampo, p: { x: number; y: number }, ladoBalon: number): string {
  const m = aMetros(vista, p);

  if (!Number.isFinite(m.x) || !Number.isFinite(m.y) || m.y < -2 || m.y > 34) return "";

  const dx = m.x - 34;
  const palo = () => {
    if (Math.abs(dx) <= 1.2 || !ladoBalon) return "";

    return Math.sign(dx) === ladoBalon ? "el 1.er palo" : "el 2.º palo";
  };

  if (Math.abs(dx) > 26 && m.y <= 12) return "la corta";
  if (m.y <= 6 && Math.abs(dx) <= 10) return palo() || "el área pequeña";
  if (m.y <= 13.5 && Math.abs(dx) <= 6) return "el punto de penalti";
  if (m.y <= 16.5 && Math.abs(dx) <= 20.2) return palo() || "el área";
  if (m.y <= 26 && Math.abs(dx) <= 22) return "la frontal";

  return "";
}

/** «de el» → «del», «a el» → «al». */
const conDe = (sitio: string) => (sitio.startsWith("el ") ? `del ${sitio.slice(3)}` : `de ${sitio}`);
const conA = (sitio: string) => (sitio.startsWith("el ") ? `al ${sitio.slice(3)}` : `a ${sitio}`);

/** El paso de una flecha: verbo y adónde. */
function pasoConSitio(lado: LadoPizarra, tipo: TipoTrazo, sitio: string) {
  if (!sitio) return VERBO[lado][tipo].toLowerCase();

  if (tipo === "bloqueo") return `bloqueas en ${sitio}`;

  if (tipo === "balon") return lado === "ofensivo" ? `la pones en ${sitio}` : `despejas hacia ${sitio}`;

  return lado === "ofensivo" ? `atacas ${sitio}` : `sales ${conA(sitio)}`;
}

/** De qué banda llega el balón (−1, 1, o 0 si no se sabe). */
function ladoDelBalon(vista: VistaCampo, todos: TrazoPizarra[]) {
  const balon = todos.filter((t) => t.tipo === "balon").sort((a, b) => a.fase - b.fase)[0];
  const salidaBalon = balon ? aMetros(vista, { x: balon.x1, y: balon.y1 }) : null;

  return salidaBalon && Math.abs(salidaBalon.x - 34) > 10 ? Math.sign(salidaBalon.x - 34) : 0;
}

/**
 * «Sales del 2.º palo · arrancas en la fase 2 · atacas el punto de penalti»:
 * de dónde parte, cuándo arranca (si no es en la primera fase) y adónde va
 * cada flecha suya, en orden. Como mucho tres pasos.
 */
function tareaPorPasos(
  vista: VistaCampo,
  lado: LadoPizarra,
  origen: { x: number; y: number } | null,
  trazos: TrazoPizarra[],
  todos: TrazoPizarra[],
) {
  if (trazos.length === 0) return "";

  const ladoBalon = ladoDelBalon(vista, todos);

  const pasos: string[] = [];

  for (const trazo of trazos) {
    const paso = pasoConSitio(lado, trazo.tipo, nombreDeSitio(vista, { x: trazo.x2, y: trazo.y2 }, ladoBalon));

    if (!pasos.includes(paso)) pasos.push(paso);
  }

  /* El que saca no «sale» de ningún sitio: su primer paso ya es el balón. */
  const desde = origen && trazos[0].tipo !== "balon" ? nombreDeSitio(vista, origen, ladoBalon) : "";
  const primeraFase = trazos[0].fase;
  const fases = Math.max(...todos.map((t) => t.fase));

  const partes = [
    desde && !pasos[0].endsWith(desde) ? (lado === "ofensivo" ? `sales ${conDe(desde)}` : `empiezas en ${desde}`) : "",
    primeraFase > 1 && fases > 1 ? `arrancas en la fase ${primeraFase}` : "",
    ...pasos.slice(0, 3),
  ].filter(Boolean);

  return mayuscula(partes.join(" · "));
}

/** Las acciones en las que sale un jugador, en el orden de la charla. */
/** Los cometidos sin el mismo «DESPUÉS» repetido en cada lámina: sólo en la primera (06/11/2026, expertos). */
export function cometidosDe(tablero: TableroPizarra, playerId: string, players: Map<string, Player>): CometidoAccion[] {
  const visto = new Set<string>();
  const ofensivasPortero = new Set<string>();
  return cometidosCrudos(tablero, playerId, players).filter((a) => {
    if (!a.sinFicha || a.lado !== "ofensivo") return true;
    const clave = a.consignas.join("|");
    if (ofensivasPortero.has(clave)) return false;
    ofensivasPortero.add(clave);
    return true;
  }).map((a) => {
    if (!a.despuesDibujado || !a.despues) return a;
    const remate = a.despues.split(":").pop()!.trim().toLowerCase();
    if (visto.has(remate)) return { ...a, despuesDibujado: false };
    visto.add(remate);
    return a;
  });
}

function cometidosCrudos(
  tablero: TableroPizarra,
  playerId: string,
  players: Map<string, Player>,
): CometidoAccion[] {
  return tablero.slides.flatMap((slide, indice) => {
    const suyas = slide.fichas.filter((ficha) => ficha.playerId === playerId);

    if (suyas.length === 0) return esPortero(players.get(playerId)) ? accionDelPortero(tablero, indice) : [];

    const lado = PLANTILLA_BY_KEY.get(slide.plantilla)?.lado ?? "ofensivo";
    const grupos = gruposDe(slide);
    const etiquetaGrupo = (key: string) => grupos.find((grupo) => grupo.key === key)?.label ?? "";

    const puestos = suyas.flatMap((ficha) => {
      const puesto = puestoDe(slide, ficha.puesto);

      return puesto
        ? [{ sigla: siglaDe(puesto), label: puesto.label, grupo: etiquetaGrupo(puesto.grupo) }]
        : [];
    });

    /* Quien comparte grupo con él: con quién hace su trabajo. */
    const susGrupos = new Set(
      suyas.map((ficha) => puestoDe(slide, ficha.puesto)?.grupo).filter(Boolean),
    );

    const companeros = [
      ...new Set(
        slide.fichas
          .filter((ficha) => ficha.playerId !== playerId)
          .filter((ficha) => susGrupos.has(puestoDe(slide, ficha.puesto)?.grupo))
          .map((ficha) => nombreCorto(players.get(ficha.playerId)))
          .filter(Boolean),
      ),
    ].slice(0, 2);

    const susTrazos = (slide.trazos ?? [])
      .filter((trazo) =>
        suyas.some((ficha) => Math.hypot(trazo.x1 - ficha.x, trazo.y1 - ficha.y) <= PIES),
      )
      .sort((a, b) => a.fase - b.fase);

    const verbos = [...new Set(susTrazos.map((trazo) => VERBO[lado][trazo.tipo]))];

    const pasos = susTrazos
      .map((trazo) => ({ fase: trazo.fase, verbo: VERBO[lado][trazo.tipo] }))
      .filter((paso, i, todos) => todos.findIndex((otro) => otro.fase === paso.fase && otro.verbo === paso.verbo) === i);

    /* Lo que hace en cada fase, con su sitio («Atacas el 1.er palo»): el rótulo del vídeo de su responsabilidad. */
    const ladoBalon = ladoDelBalon(slide.vista, slide.trazos ?? []);
    const pasosFase = susTrazos
      .map((trazo) => ({
        fase: trazo.fase,
        texto: mayuscula(pasoConSitio(lado, trazo.tipo, nombreDeSitio(slide.vista, { x: trazo.x2, y: trazo.y2 }, ladoBalon))),
      }))
      .filter((paso, i, todos) => todos.findIndex((otro) => otro.fase === paso.fase) === i);

    const intencion = slide.guion?.intencion?.trim() ? normalizaConsigna(slide.guion.intencion.trim()) : "";
    const senal = lado === "ofensivo" && slide.guion?.senal?.trim() ? normalizaConsigna(slide.guion.senal.trim()) : "";

    const mision = [
      verbos.length ? lista(verbos.map((v, i) => (i ? v.toLowerCase() : v))) : "",
      companeros.length ? `con ${lista(companeros)}` : "",
      intencion ? `para ${intencion.charAt(0).toLowerCase()}${intencion.slice(1).replace(/\.$/, "")}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    /* El rival con dorsal más cercano a cualquiera de sus fichas en el campo. */
    const cercano = (slide.rivales ?? [])
      .filter((otro) => otro.dorsal?.trim())
      .map((otro) => ({
        dorsal: otro.dorsal!.trim(),
        d: Math.min(...suyas.filter((f) => f.x >= 0).map((f) => Math.hypot(otro.x - f.x, otro.y - f.y))),
      }))
      .filter((otro) => otro.d <= CERCA_RIVAL)
      .sort((a, b) => a.d - b.d)[0];

    /* La marca decidida en «Quién marca a quién» manda sobre la chapa más cercana. */
    const marcado = suyas.map((f) => (f.puesto ? slide.marcas?.[f.puesto] : "")).find(Boolean);

    const rival = marcado
      ? `Marcas al ${marcado}`
      : cercano
      ? lado === "defensivo"
        ? `Marcas al ${cercano.dorsal}`
        : `Te vigila el ${cercano.dorsal}`
      : "";

    const dorsalSuyo = marcado || cercano?.dorsal || "";
    const marcaDorsal = marcado || (lado === "defensivo" ? (cercano?.dorsal ?? "") : "");

    /* Sus compañeros de zona en el campo: el recorte del PDF no los corta. */
    const zona = slide.fichas
      .filter((ficha) => ficha.playerId !== playerId && ficha.x >= 0 && ficha.y >= 0)
      .filter((ficha) => susGrupos.has(puestoDe(slide, ficha.puesto)?.grupo))
      .map((ficha) => ({ x: ficha.x, y: ficha.y }));

    const sitio = suyas.find((f) => f.x >= 0 && f.y >= 0);
    const tarea = tareaPorPasos(slide.vista, lado, sitio ? { x: sitio.x, y: sitio.y } : null, susTrazos, slide.trazos ?? []);
    const marcaPunto =
      (dorsalSuyo && (slide.rivales ?? []).find((otro) => otro.dorsal?.trim() === dorsalSuyo)) || null;

    const foco = [
      ...suyas.filter((f) => f.x >= 0 && f.y >= 0).map((f) => ({ x: f.x, y: f.y })),
      ...susTrazos.flatMap((t) => [
        { x: t.x2, y: t.y2 },
        ...(t.cx != null && t.cy != null ? [{ x: t.cx, y: t.cy }] : []),
      ]),
      ...(marcaPunto ? [{ x: marcaPunto.x, y: marcaPunto.y }] : []),
      /* El balón (de dónde sale y adónde va): sin él, su sitio no se entiende. */
      ...(slide.trazos ?? [])
        .filter((t) => t.tipo === "balon")
        .flatMap((t) => [
          { x: t.x1, y: t.y1 },
          { x: t.x2, y: t.y2 },
        ]),
    ];

    const transicion = adornosDe(slide).find((adorno) => adorno.tipo === "transicion");
    /*
    | Sin flecha de transición dibujada, lo que le toca por su papel (agente
    | experto-futbol): en un córner a favor el riesgo es la contra, y en uno en
    | contra, quedarse dentro del área tras despejar.
    */
    const papeles = plano(puestos.map((p) => `${p.grupo} ${p.label}`).join(" "));
    const porPapel =
      lado === "defensivo"
        ? "Si despejamos: salimos juntos del área, nadie se queda dentro"
        : /equilibr|rechace|cierra|zaguero|defensa/.test(papeles)
          ? "Si despejan: cierras la contra, que nadie corra a tu espalda"
          : "Si despejan: segunda jugada y repliegas rápido";
    const despues =
      transicion && transicion.tipo === "transicion"
        ? [transicion.label, transicion.remate].map((t) => t?.trim()).filter(Boolean).join(": ")
        : porPapel;

    const claves = [
      ...new Set(
        [...puestos.flatMap((p) => [p.label, p.grupo]), nombreCorto(players.get(playerId))]
          .map(plano)
          .filter((clave) => clave.length > 2),
      ),
    ];

    const siglas = puestos.map((p) => p.sigla).filter((sigla) => sigla.length >= 2 && sigla === sigla.toUpperCase());

    return [
      {
        indice,
        titulo: tituloVisible(tablero.slides, indice),
        lado,
        puestos,
        mision: mision.charAt(0).toLocaleUpperCase("es-ES") + mision.slice(1),
        senal,
        consignas: consignasSuyas(lineasConsignas(slide.notas), claves, siglas).map((texto) => conNombres(texto, players)),
        rival,
        despues: despues ? despues.charAt(0).toLocaleUpperCase("es-ES") + despues.slice(1).toLowerCase() : "",
        pasos,
        pasosFase,
        con: companeros,
        para: intencion ? intencion.replace(/\.$/, "") : "",
        foco,
        marcaPunto: marcaPunto ? { x: marcaPunto.x, y: marcaPunto.y } : null,
        despuesDibujado: Boolean(transicion),
        tarea,
        marcaDorsal,
        zona,
        otros: slide.fichas
          .filter((ficha) => ficha.playerId !== playerId && ficha.x >= 0 && ficha.y >= 0)
          .map((ficha) => ({ x: ficha.x, y: ficha.y })),
      },
    ];
  });
}

/* ------------------------------------------------------------------ */
/*  DIBUJO                                                             */
/* ------------------------------------------------------------------ */

/*
| La hoja mide lo que mide su contenido (01/11/2026): 1080 de ancho y el alto
| justo. En el móvil el PDF se ve a lo ancho y se pasa con el dedo; un 9:16
| fijo dejaba media hoja en blanco cuando la acción tiene poco texto.
*/
function lienzo(alto: number) {
  const canvas = document.createElement("canvas");

  canvas.width = HOJA_W;
  canvas.height = Math.round(alto);

  const ctx = canvas.getContext("2d") as Ctx;

  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, HOJA_W, canvas.height);
  ctx.textBaseline = "alphabetic";

  return { canvas, ctx };
}

/** Un lienzo diminuto sólo para medir textos antes de saber el alto de la hoja. */
let medidor: Ctx | null = null;

function midiendo() {
  if (!medidor) {
    const canvas = document.createElement("canvas");

    canvas.width = 8;
    canvas.height = 8;
    medidor = canvas.getContext("2d") as Ctx;
  }

  return medidor;
}

function filoRosa(ctx: Ctx) {
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, ctx.canvas.height - 12, HOJA_W, 12);
}

/** Parte un texto en renglones que quepan en `maxW` con la letra puesta. */
function renglones(ctx: Ctx, texto: string, maxW: number) {
  const salida: string[] = [];
  let linea = "";

  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;

    if (linea && ctx.measureText(prueba).width > maxW) {
      salida.push(linea);
      linea = palabra;
    } else {
      linea = prueba;
    }
  }

  if (linea) salida.push(linea);

  return salida;
}

function colorLado(lado: LadoPizarra) {
  return lado === "ofensivo" ? C.verde : C.navy;
}

const mayuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase("es-ES") + texto.slice(1);
const minuscula = (texto: string) => texto.charAt(0).toLocaleLowerCase("es-ES") + texto.slice(1);

type Escudos = { nuestro: HTMLImageElement | null; rival: HTMLImageElement | null };

type Contexto = {
  player: Player | undefined;
  rival: string;
  jornada?: string;
  /** «YYYY-MM-DD» del partido, para el pie. */
  fecha?: string;
  escudos: Escudos;
};

/** Escudo, o la inicial del club en un disco si no lo hay (lo usa el vídeo). */
function escudo(ctx: Ctx, imagen: HTMLImageElement | null, nombre: string, x: number, y: number, lado: number, oscuro = false) {
  if (imagen) {
    encaja(ctx, imagen, x, y, lado, lado);

    return;
  }

  ctx.fillStyle = oscuro ? "rgba(255,255,255,.12)" : C.crema;
  ctx.beginPath();
  ctx.arc(x + lado / 2, y + lado / 2, lado / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = oscuro ? C.crema : C.navy;
  fuente(ctx, lado * 0.5, 700);
  ctx.textAlign = "center";
  ctx.fillText((nombre.trim()[0] ?? "").toUpperCase(), x + lado / 2, y + lado * 0.68);
  ctx.textAlign = "left";
}

/* ----------------------------- cabecera ----------------------------- */

/*
| Cabecera mínima: una franja con nuestro escudo, su dorsal y su nombre, y a
| la derecha por dónde va. La jornada, el rival y la fecha bajaron al pie
| (01/11/2026, expertos): arriba sólo lo que identifica la hoja.
*/
const CABEZA_H = 112;

function cabecera(ctx: Ctx, cx: Contexto, marcador: string) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, HOJA_W, CABEZA_H);
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, CABEZA_H - 6, HOJA_W, 6);

  let x = MARGEN - 18;

  if (cx.escudos.nuestro) {
    encaja(ctx, cx.escudos.nuestro, x, 18, 72, 72);
    x += 90;
  }

  const dorsal = cx.player?.dorsal != null ? String(cx.player.dorsal).trim() : "";

  if (dorsal) {
    ctx.fillStyle = C.rosa;
    fuente(ctx, 74, 700);
    x += textoEspaciado(ctx, dorsal, x, 84, 0) + 16;
  }

  const derecha = HOJA_W - MARGEN;

  ctx.textAlign = "right";
  ctx.fillStyle = C.rosa;
  fuente(ctx, 32, 700);
  const anchoMarcador = ctx.measureText(marcador).width;
  ctx.fillText(marcador, derecha, 72);
  ctx.textAlign = "left";

  const nombre = (nombreCorto(cx.player) || "Balón parado").toUpperCase();

  ctx.fillStyle = C.crema;
  ajusta(ctx, nombre, derecha - anchoMarcador - 30 - x, 60, 700, 1);
  textoEspaciado(ctx, nombre, x, 82, 1);
}

/* ------------------------------- pie ------------------------------- */

/** El pie: «Cartagena · J10 · 31 oct» a la izquierda y «1 / 9» a la derecha. */
const PIE_H = 70;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/**
 * «2026-10-31» → «31 oct»; con hora («2026-11-13T21:15», la del calendario)
 * → «vie 13 nov · 21:15», como el informe de la semana (10/11/2026). Lo que
 * no se entiende, fuera.
 */
export function fechaCorta(iso: string | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso ?? "");

  if (!m) return "";

  const mes = MESES[Number(m[2]) - 1];

  if (!mes) return "";

  const dia = `${Number(m[3])} ${mes}`;

  if (!m[4] || (m[4] === "00" && m[5] === "00")) return dia;

  const semana = DIAS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];

  return `${semana} ${dia} · ${m[4]}:${m[5]}`;
}

/** Una zona de la hoja que se puede pulsar en el PDF, en píxeles de la hoja. */
export type ZonaHoja = { x: number; y: number; w: number; h: number };

/**
 * El pie. Con `volver`, a la derecha va el botón «RESUMEN» (01/11/2026: «los
 * PDF deben tener enlaces para ir a cada diapositiva»): devuelve dónde ha
 * caído para que el PDF le ponga el salto a la primera hoja.
 */
function pie(ctx: Ctx, cx: Contexto, pagina: number, total: number, volver = false): ZonaHoja | null {
  const base = ctx.canvas.height - 12 - 24;
  const texto = [cx.rival, cx.jornada, fechaCorta(cx.fecha)].map((t) => t?.trim()).filter(Boolean).join(" · ");

  ctx.fillStyle = "rgba(15,30,61,.12)";
  ctx.fillRect(MARGEN, ctx.canvas.height - 12 - PIE_H + 6, HOJA_W - MARGEN * 2, 2);

  ctx.fillStyle = "rgba(15,30,61,.62)";
  fuente(ctx, 30, 600);
  const numero = `${pagina} / ${total}`;
  const anchoNumero = ctx.measureText(numero).width;

  /* El botón de vuelta: píldora azul con la punta rosa, a la izquierda del número. */
  let boton: ZonaHoja | null = null;

  if (volver) {
    fuente(ctx, 26, 700);
    const rotulo = "VOLVER AL RESUMEN";
    const anchoRotulo = anchoEspaciado(ctx, rotulo, 2);
    const w = anchoRotulo + 74;
    const h = 46;
    const x = HOJA_W - MARGEN - anchoNumero - 28 - w;
    const y = base - 33;

    ctx.fillStyle = C.navy;
    rectRedondo(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = C.rosa;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + h / 2);
    ctx.lineTo(x + 38, y + h / 2 - 10);
    ctx.lineTo(x + 38, y + h / 2 + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.crema;
    textoEspaciado(ctx, rotulo, x + 52, y + h / 2 + 9, 2);
    boton = { x: x - 6, y: y - 6, w: w + 12, h: h + 12 };
  }

  ctx.fillStyle = "rgba(15,30,61,.62)";

  if (texto) {
    const libre = boton ? boton.x - MARGEN - 24 : HOJA_W - MARGEN * 2 - anchoNumero - 40;

    ajusta(ctx, texto, libre, 30, 600, 1);
    textoEspaciado(ctx, texto, MARGEN, base, 1);
  }

  fuente(ctx, 30, 700);
  ctx.textAlign = "right";
  ctx.fillText(numero, HOJA_W - MARGEN, base);
  ctx.textAlign = "left";

  filoRosa(ctx);

  return boton;
}

/* ----------------------------- resumen ----------------------------- */

/**
 * La primera hoja, cuando tiene dos acciones o más: todas de un vistazo, una
 * fila por acción con su sigla, su puesto y a quién marca. Es lo que se
 * relee en el autobús sin pasar páginas.
 */
const RESUMEN_Y = CABEZA_H + 176;
const RESUMEN_FILA = 150;
const altoResumen = (acciones: number) => RESUMEN_Y + acciones * RESUMEN_FILA + 16 + PIE_H;

function dibujaResumen(ctx: Ctx, cx: Contexto, acciones: CometidoAccion[], total: number): ZonaHoja[] {
  cabecera(ctx, cx, `${acciones.length} ACCIONES`);

  ctx.fillStyle = C.navy;
  ajusta(ctx, "TU BALÓN PARADO", HOJA_W - MARGEN * 2, 96, 700, 2);
  textoEspaciado(ctx, "TU BALÓN PARADO", MARGEN, CABEZA_H + 116, 2);
  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, CABEZA_H + 136, 200, 10);

  const y0 = RESUMEN_Y;
  const fila = RESUMEN_FILA;
  const alto = fila - 14;
  const zonas: ZonaHoja[] = [];

  acciones.forEach((accion, orden) => {
    const top = y0 + orden * fila;

    /* Toda la fila salta a su hoja en el PDF. */
    zonas.push({ x: MARGEN, y: top, w: HOJA_W - MARGEN * 2, h: alto });

    ctx.fillStyle = C.crema;
    rectRedondo(ctx, MARGEN, top, HOJA_W - MARGEN * 2, alto, 18);
    ctx.fill();
    ctx.fillStyle = colorLado(accion.lado);
    rectRedondo(ctx, MARGEN, top, 12, alto, 6);
    ctx.fill();

    /* La sigla, que es lo que busca en la pizarra. */
    const r = Math.min(48, alto * 0.36);
    const discoX = MARGEN + 40 + r;
    /* Con más de dos puestos, la sigla en clave no se lee («D3·I1·P3·F3»): el número de lanzamientos. */
    /* Si todas las filas llevan la misma sigla (el portero: «POR» cinco veces), el número de la acción. */
    const todasIguales = acciones.length > 1 && acciones.every((a) => a.puestos.map((p) => p.sigla).join() === accion.puestos.map((p) => p.sigla).join());
    const sigla = todasIguales ? String(orden + 1) : accion.puestos.length > 2 ? `×${accion.puestos.length}` : accion.puestos.map((p) => p.sigla).join("·") || "★";

    ctx.fillStyle = C.rosa;
    ctx.beginPath();
    ctx.arc(discoX, top + alto / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.navy;
    const pxSigla = ajusta(ctx, sigla, r * 1.6, r * 0.95, 700, 0);
    ctx.textAlign = "center";
    ctx.fillText(sigla, discoX, top + alto / 2 + pxSigla * 0.35);

    /* La hoja donde está explicada. */
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(15,30,61,.55)";
    fuente(ctx, 30, 600);
    const hoja = `PÁG. ${orden + 2}`;
    ctx.fillText(hoja, HOJA_W - MARGEN - 24, top + alto / 2 + 10);
    const anchoHoja = ctx.measureText(hoja).width;
    ctx.textAlign = "left";

    const tx = discoX + r + 26;
    const maxW = HOJA_W - MARGEN - 24 - anchoHoja - 24 - tx;
    /* Lo que hace, no sólo el puesto (segunda ronda de jueces): «Arrancas en la fase 2 · atacas el 2.º palo». */
    const detalle = (titulares(accion, undefined).grande || [accion.puestos.map((p) => p.label).join(" · "), accion.rival].filter(Boolean).join(" · ")).toUpperCase();

    ctx.fillStyle = C.navy;
    ajusta(ctx, accion.titulo.toUpperCase(), maxW, Math.min(46, alto * 0.36), 700, 1);
    textoEspaciado(ctx, accion.titulo.toUpperCase(), tx, top + (detalle ? alto * 0.47 : alto / 2 + 14), 1);

    if (detalle) {
      ctx.fillStyle = accion.lado === "ofensivo" ? C.verde : "#7A1F2B";
      ajusta(ctx, detalle, maxW, Math.min(34, alto * 0.27), 600, 1);
      textoEspaciado(ctx, detalle, tx, top + alto * 0.8, 1);
    }
  });

  pie(ctx, cx, 1, total);

  return zonas;
}

/* ----------------------------- una acción ----------------------------- */

/** Dónde empieza el campo en la diapositiva (debajo de su título). */
const CAMPO_ARRIBA = CABECERA_SLIDE;
/** El panel de puestos de la derecha: si él no está ahí, no se enseña. */
const CAMPO_DERECHA = 1516;
/** Dónde acaba el campo: debajo va la franja de consignas (206 px en TableroSlide), que aquí salía cortada. */
const CAMPO_ABAJO = TABLERO_H - 206 - 14;

/**
 * Cómo cae la diapositiva en su foto (01/11/2026). Al enseñarla, la pizarra
 * ACERCA el campo a la jugada (`maquetaDe` en TableroSlide): una ficha en
 * (x, y) de la plantilla sale en la foto en (dx + x·k, dy + y·k), y el césped
 * ocupa sólo el rectángulo `campo`. Sin marco, la foto es la plantilla tal
 * cual (el arnés de Node) y el césped, lo que queda entre la cabecera, el
 * panel y las consignas.
 */
export type MarcoCaptura = { k: number; dx: number; dy: number; campo: { x: number; y: number; w: number; h: number } };

const MARCO_PLANO: MarcoCaptura = {
  k: 1,
  dx: 0,
  dy: 0,
  campo: { x: 0, y: CAMPO_ARRIBA, w: CAMPO_DERECHA, h: CAMPO_ABAJO - CAMPO_ARRIBA },
};

type Encuadre = { sx: number; sy: number; sw: number; sh: number; alto: number; k: number };

/** Lo que ocupa una ficha alrededor de sus pies (foto de 120 encima, chapa y nombre debajo). */
const FICHA = { izq: 72, der: 72, arriba: 150, abajo: 62 };
/** Alto máximo del campo en la hoja: más, y el texto de debajo se va del primer vistazo. */
const CAMPO_MAX_HOJA = 1180;

/**
 * El trozo de la foto que le importa: él y sus compañeros de zona ENTEROS
 * (con su foto y su chapa, que antes se cortaban por la derecha y por
 * abajo), sus flechas, el rival que marca y el balón, con aire alrededor.
 * Nunca sale del césped: ni la cabecera, ni el panel, ni las consignas.
 */
function encuadre(accion: CometidoAccion, yo: { x: number; y: number } | null, marco: MarcoCaptura): Encuadre {
  const { k, dx, dy, campo } = marco;
  const cajas: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const caja = (p: { x: number; y: number }, m: typeof FICHA) =>
    cajas.push({ x0: dx + (p.x - m.izq) * k, y0: dy + (p.y - m.arriba) * k, x1: dx + (p.x + m.der) * k, y1: dy + (p.y + m.abajo) * k });

  accion.zona.forEach((p) => caja(p, FICHA));
  accion.foco.forEach((p) => caja(p, { izq: 50, der: 50, arriba: 110, abajo: 50 }));

  if (accion.marcaPunto) caja(accion.marcaPunto, { izq: 50, der: 50, arriba: 90, abajo: 30 });

  /* Su cara, medida en la foto: ya viene en píxeles de la foto. */
  if (yo) cajas.push({ x0: yo.x - 80 * k, y0: yo.y - 120 * k, x1: yo.x + 80 * k, y1: yo.y + 130 * k });

  if (cajas.length === 0) {
    return { sx: campo.x, sy: campo.y, sw: campo.w, sh: campo.h, alto: Math.round((HOJA_W * campo.h) / campo.w), k };
  }

  /* Lo que se sale del césped no se puede enseñar: se recorta a él. */
  const x0 = Math.max(campo.x, Math.min(...cajas.map((c) => c.x0)));
  const y0 = Math.max(campo.y, Math.min(...cajas.map((c) => c.y0)));
  const x1 = Math.min(campo.x + campo.w, Math.max(...cajas.map((c) => c.x1)));
  const y1 = Math.min(campo.y + campo.h, Math.max(...cajas.map((c) => c.y1)));
  const aire = 24 * k;

  /* Nunca menos de media diapositiva: la referencia del área y la portería. */
  let w = Math.min(campo.w, Math.max(x1 - x0 + aire * 2, 1000 * k));
  const h = Math.min(campo.h, Math.max(y1 - y0 + aire * 2, w * 0.62));

  /* Si sale muy alto en la hoja, se abre a lo ancho (si cabe) antes que encoger. */
  if ((HOJA_W * h) / w > CAMPO_MAX_HOJA) w = Math.min(campo.w, (h * HOJA_W) / CAMPO_MAX_HOJA);

  const cxBox = (x0 + x1) / 2;
  const cyBox = (y0 + y1) / 2;

  return {
    sx: Math.max(campo.x, Math.min(campo.x + campo.w - w, cxBox - w / 2)),
    sy: Math.max(campo.y, Math.min(campo.y + campo.h - h, cyBox - h / 2)),
    sw: w,
    sh: h,
    alto: Math.round((HOJA_W * h) / w),
    k,
  };
}

/**
 * Él en foco y el resto en penumbra; su hombre, también con luz. La foto del
 * tablero es la misma para los once (se hace una vez): el resalte va aquí.
 */
function resalta(
  ctx: Ctx,
  enc: Encuadre,
  top: number,
  punto: { x: number; y: number } | null,
  marca: { x: number; y: number } | null,
  accion: CometidoAccion,
  otros: { x: number; y: number }[] = [],
) {
  const z = HOJA_W / enc.sw;
  /* Los tamaños, de la ficha en la foto: si la pizarra acercó el campo, el aro crece con ella. */
  const s = z * enc.k;
  const enHoja = (p: { x: number; y: number }) => ({ x: (p.x - enc.sx) * z, y: (p.y - enc.sy) * z });

  const capa = document.createElement("canvas");

  capa.width = HOJA_W;
  capa.height = enc.alto;

  const c = capa.getContext("2d") as Ctx;

  c.fillStyle = "rgba(8,14,28,.55)";
  c.fillRect(0, 0, HOJA_W, enc.alto);
  c.globalCompositeOperation = "destination-out";

  const luz = (p: { x: number; y: number }, dentro: number, fuera: number) => {
    const g = c.createRadialGradient(p.x, p.y, dentro, p.x, p.y, fuera);

    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, HOJA_W, enc.alto);
  };

  const yo = punto ? enHoja(punto) : null;
  const suyo = marca ? enHoja(marca) : null;

  if (yo) luz(yo, 80 * s, 260 * s);
  if (suyo) luz(suyo, 50 * s, 150 * s);

  if (yo || suyo) ctx.drawImage(capa, 0, top);

  capa.width = 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, HOJA_W, enc.alto);
  ctx.clip();

  if (suyo) {
    const radio = 46 * s;

    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(suyo.x, top + suyo.y, radio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    chapa(ctx, accion.rival.startsWith("Marcas") ? "TU HOMBRE" : "TE VIGILA", {
      x: suyo.x,
      y: Math.min(top + enc.alto - 48, top + suyo.y + radio + 10),
      alto: 40,
      fondo: "#7A1F2B",
      tinta: C.crema,
      tamano: 24,
      espaciado: 2,
      padding: 14,
      desdeCentro: true,
    });
  }

  if (yo) {
    const radio = 42 * s;

    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(yo.x, top + yo.y, radio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = C.rosa;
    ctx.lineWidth = 7;
    ctx.stroke();

    /*
    | Donde no tape a nadie (06/11/2026, expertos): arriba tapaba el nombre del
    | de delante. Se prueba arriba, a los lados y abajo; gana el primero con
    | aire y, si ninguno lo tiene, el que más.
    */
    const ocupados = otros.map(enHoja);
    const candidatos = [
      { x: yo.x, y: yo.y - radio - 33 },
      { x: yo.x + radio + 58, y: yo.y - radio * 0.5 },
      { x: yo.x - radio - 58, y: yo.y - radio * 0.5 },
      { x: yo.x, y: yo.y + radio + 92 },
    ].filter((p) => p.y - 23 > 4 && p.y + 23 < enc.alto - 4 && p.x - 48 > 0 && p.x + 48 < HOJA_W);
    const aire = (p: { x: number; y: number }) => Math.min(9999, ...ocupados.map((o) => Math.hypot((o.x - p.x) / 1.5, o.y - p.y)));
    const sitioChapa =
      candidatos.find((p) => aire(p) > 62 * s) ?? [...candidatos].sort((a, b) => aire(b) - aire(a))[0] ?? { x: yo.x, y: yo.y - radio - 33 };

    chapa(ctx, "TÚ", {
      x: sitioChapa.x,
      y: Math.max(top + 10, top + sitioChapa.y - 23),
      alto: 46,
      fondo: C.rosa,
      tinta: C.navy,
      tamano: 30,
      espaciado: 2,
      padding: 18,
      desdeCentro: true,
    });
  }

  ctx.restore();
}

/** Lo que hace sin flechas con sitio: «Atacas con Carvajal y Óscar». */
function queHaces(accion: CometidoAccion) {
  const hacer = lista([...new Set(accion.pasos.map((p) => p.verbo))].map((v, i) => (i ? v.toLowerCase() : v)));

  return hacer ? mayuscula([hacer, accion.con.length ? `con ${lista(accion.con)}` : ""].filter(Boolean).join(" ")) : "";
}

/** Quién es su hombre: dorsal, nombre y altura si se saben. */
export type SuJugador = { nombre: string; altura: number | null };

const metros = (cm: number | null) => (cm && cm >= 150 && cm <= 215 ? `${(cm / 100).toFixed(2).replace(".", ",")} m` : "");

/**
 * Lo que va arriba y en grande (01/11/2026, expertos): lo que HACE. En las
 * defensivas con marca, «Marcas al 4 Pérez (1,86 m)»; si no, su tarea por
 * pasos; sin flechas, el titular «Atacas con Carvajal y Óscar»; y si no hay
 * nada de eso, su puesto. Debajo, más pequeño, con quién y para qué.
 */
/**
 * Varios puestos en la misma acción (las directas), en palabras (06/11/2026):
 * salía «Falta lateral d · 2 · penalti · 2 · falta frontal · 2». Ahora
 * «Tiras: penalti (2.º), falta lateral derecha (2.º) y falta frontal (2.º)».
 */
function puestosEnPalabras(puestos: { label: string }[]) {
  const uno = (label: string) => {
    const limpio = label.toLocaleLowerCase("es-ES").replace(/\s*·\s*/g, " ").trim();
    const m = limpio.match(/^(.*?)\s+(\d+)$/);
    const nombre = (m ? m[1] : limpio).replace(/\bd$/, "derecha").replace(/\bi$/, "izquierda");
    return m ? `${nombre} (${m[2]}.º)` : nombre;
  };
  const partes = puestos.map((p) => uno(p.label));
  return partes.length > 1 ? `Tiras: ${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}` : mayuscula(partes[0] ?? "");
}

function titulares(accion: CometidoAccion, suyos: Map<string, SuJugador> | undefined) {
  const puesto = puestosEnPalabras(accion.puestos);
  const con = accion.con.length ? `con ${lista(accion.con)}` : "";
  const para = accion.para ? `para ${minuscula(accion.para)}` : "";

  if (accion.lado === "defensivo") {
    if (accion.marcaDorsal) {
      const su = suyos?.get(accion.marcaDorsal);
      const alto = metros(su?.altura ?? null);
      const grande = [`Marcas al ${accion.marcaDorsal}`, su?.nombre ?? "", alto ? `(${alto})` : ""].filter(Boolean).join(" ");

      return { grande, debajo: mayuscula([accion.tarea ? minuscula(accion.tarea) : "", con, para].filter(Boolean).join(" · ")) };
    }

    return { grande: accion.tarea || verboDefensivo(accion.puestos) || puesto, debajo: mayuscula([con, para].filter(Boolean).join(" · ")) };
  }

  if (accion.tarea) return { grande: accion.tarea, debajo: mayuscula([con, para].filter(Boolean).join(" · ")) };

  const titular = queHaces(accion);

  if (titular) return { grande: titular, debajo: mayuscula(para) };

  return { grande: puesto, debajo: mayuscula([con, para].filter(Boolean).join(" · ")) };
}

type PlanAccion = {
  yo: { x: number; y: number } | null;
  otros: { x: number; y: number }[];
  marca: { x: number; y: number } | null;
  enc: Encuadre | null;
  grande: string[];
  debajo: string[];
  yCampo: number;
  alto: number;
};

const GRANDE_PX = 60;
const DEBAJO_PX = 40;

/**
 * Lo que va arriba: el lado y la acción, su sigla y su puesto en una línea
 * pequeña, y en grande lo que hace. Con `pinta` en falso sólo mide.
 */
function bloqueArriba(ctx: Ctx, accion: CometidoAccion, plan: Pick<PlanAccion, "grande" | "debajo">, pinta: boolean) {
  let y = CABEZA_H + 28;

  /* 1 · El lado y la acción, en una línea. */
  if (pinta) {
    const lado = LADO_PIZARRA_LABEL[accion.lado].toUpperCase();
    const opciones = {
      x: MARGEN,
      y,
      alto: 40,
      fondo: accion.lado === "ofensivo" ? C.verde : C.rosa,
      tinta: accion.lado === "ofensivo" ? C.crema : C.navy,
      tamano: 22,
      espaciado: 3,
      padding: 16,
    };
    const anchoLado = chapa(ctx, lado, { ...opciones, soloMide: true }) as number;

    chapa(ctx, lado, opciones);

    const titulo = accion.titulo.toUpperCase();
    const tx = MARGEN + anchoLado + 18;

    ctx.fillStyle = C.navy;
    ajusta(ctx, titulo, HOJA_W - MARGEN - tx, 44, 700, 1);
    textoEspaciado(ctx, titulo, tx, y + 34, 1);
  }

  y += 40 + 24;

  /* 2 · Su sigla y su puesto (y quién le vigila), pequeño. */
  if (pinta) {
    /* Con más de dos puestos, la sigla en clave no se lee («D3·I1·P3·F3»): el número de lanzamientos. */
    const sigla = accion.puestos.length > 2 ? `×${accion.puestos.length}` : accion.puestos.map((p) => p.sigla).join("·") || "★";
    const r = 22;

    ctx.fillStyle = C.rosa;
    ctx.beginPath();
    ctx.arc(MARGEN + r, y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.navy;
    const px = ajusta(ctx, sigla, r * 1.7, 26, 700, 0);
    ctx.textAlign = "center";
    ctx.fillText(sigla, MARGEN + r, y + r + px * 0.35);
    ctx.textAlign = "left";

    /* «POR PORTERO» se leía como un fallo (segunda ronda de jueces): «Tu puesto: portero». */
    const linea = [
      `Tu puesto: ${accion.puestos.map((p) => p.label).join(" · ")}`,
      accion.lado === "ofensivo" ? accion.rival : "",
    ]
      .filter(Boolean)
      .join(" · ")
      .toUpperCase();

    if (linea) {
      ctx.fillStyle = "rgba(15,30,61,.72)";
      ajusta(ctx, linea, HOJA_W - MARGEN - (MARGEN + r * 2 + 16), 30, 600, 2);
      textoEspaciado(ctx, linea, MARGEN + r * 2 + 16, y + r + 11, 2);
    }
  }

  y += 44 + 8;

  /* 3 · Lo que hace, en grande. */
  for (const linea of plan.grande) {
    y += GRANDE_PX * 1.08;

    if (pinta) {
      ctx.fillStyle = C.navy;
      fuente(ctx, GRANDE_PX, 700);
      ctx.fillText(linea, MARGEN, y);
    }
  }

  /* 4 · Con quién y para qué. */
  if (plan.debajo.length) y += 8;

  for (const linea of plan.debajo) {
    y += DEBAJO_PX * 1.2;

    if (pinta) {
      ctx.fillStyle = colorLado(accion.lado);
      fuente(ctx, DEBAJO_PX, 600);
      ctx.fillText(linea, MARGEN, y);
    }
  }

  return y + 26;
}

/** SEÑAL, OJO y DESPUÉS, con su chapa; la señal, la primera. */
function bloqueNotas(ctx: Ctx, accion: CometidoAccion, y0: number, pinta: boolean) {
  let y = y0 + 30;
  const ancho = HOJA_W - MARGEN * 2;

  const notas: { rotulo: string; fondo: string; tinta: string; texto: string }[] = [
    ...(accion.senal ? [{ rotulo: "SEÑAL", fondo: C.navy, tinta: C.crema, texto: accion.senal }] : []),
    ...accion.consignas.map((texto) => ({ rotulo: "OJO", fondo: C.rosa, tinta: C.navy, texto })),
    ...(accion.despuesDibujado && accion.despues
      ? [{ rotulo: "DESPUÉS", fondo: C.verde, tinta: C.crema, texto: accion.despues }]
      : []),
  ];

  const sangria = 170;

  for (const nota of notas) {
    fuente(ctx, 40, 500);
    const filas = renglones(ctx, nota.texto, ancho - sangria);

    if (pinta) {
      chapa(ctx, nota.rotulo, {
        x: MARGEN,
        y: y + 4,
        alto: 44,
        fondo: nota.fondo,
        tinta: nota.tinta,
        tamano: 24,
        espaciado: 3,
        padding: 16,
        anchoMin: sangria - 22,
      });

      ctx.fillStyle = C.navy;
      fuente(ctx, 40, 500);
      filas.forEach((fila, i) => ctx.fillText(fila, MARGEN + sangria, y + 40 + i * 50));
    }

    y += Math.max(54, filas.length * 50) + 20;
  }

  return notas.length ? y : y0;
}

/** Lo que mide la hoja de una acción, antes de pintarla. */
function planAccion(
  accion: CometidoAccion,
  punto: { x: number; y: number } | null,
  conTablero: boolean,
  marco: MarcoCaptura,
  suyos: Map<string, SuJugador> | undefined,
): PlanAccion {
  const enFoto = (p: { x: number; y: number }) => ({ x: marco.dx + p.x * marco.k, y: marco.dy + p.y * marco.k });
  const yo = accion.sinFicha ? null : punto ?? (accion.foco[0] ? enFoto({ x: accion.foco[0].x, y: accion.foco[0].y - 50 }) : null);
  /* Cara y nombre de cada uno de los demás, en la foto. */
  const otros = accion.otros.flatMap((p) => [enFoto({ x: p.x, y: p.y - 50 }), enFoto({ x: p.x, y: p.y + 4 })]);
  const marca = accion.marcaPunto ? enFoto({ x: accion.marcaPunto.x, y: accion.marcaPunto.y - 30 }) : null;
  const enc = conTablero ? encuadre(accion, yo, marco) : null;

  const medida = midiendo();
  const { grande, debajo } = titulares(accion, suyos);
  const ancho = HOJA_W - MARGEN * 2;

  fuente(medida, GRANDE_PX, 700);
  const lineasGrande = grande ? renglones(medida, grande, ancho).slice(0, 3) : [];

  fuente(medida, DEBAJO_PX, 600);
  const lineasDebajo = debajo ? renglones(medida, debajo, ancho).slice(0, 2) : [];

  const yCampo = bloqueArriba(medida, accion, { grande: lineasGrande, debajo: lineasDebajo }, false);
  const yNotas = yCampo + (enc ? enc.alto + 8 : 0);
  const alto = bloqueNotas(medida, accion, yNotas, false) + 10 + PIE_H;

  return { yo, otros, marca, enc, grande: lineasGrande, debajo: lineasDebajo, yCampo, alto };
}

function dibujaAccion(
  ctx: Ctx,
  cx: Contexto,
  accion: CometidoAccion,
  tablero: CanvasImageSource | null,
  plan: PlanAccion,
  orden: number,
  acciones: number,
  pagina: number,
  paginas: number,
  volver = false,
): ZonaHoja | null {
  cabecera(ctx, cx, acciones > 1 ? `ACCIÓN ${orden} DE ${acciones}` : "BALÓN PARADO");

  bloqueArriba(ctx, accion, plan, true);

  /* El campo, encuadrado en lo suyo y con él en foco. */
  const { enc, yo, marca, yCampo, otros } = plan;

  if (tablero && enc) {
    const k = ("width" in tablero ? Number(tablero.width) : TABLERO_W) / TABLERO_W;

    ctx.fillStyle = C.rosa;
    ctx.fillRect(0, yCampo - 8, HOJA_W, 8);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tablero, enc.sx * k, enc.sy * k, enc.sw * k, enc.sh * k, 0, yCampo, HOJA_W, enc.alto);
    resalta(ctx, enc, yCampo, yo, marca, accion, otros);

    ctx.fillStyle = C.rosa;
    ctx.fillRect(0, yCampo + enc.alto, HOJA_W, 8);
  }

  bloqueNotas(ctx, accion, yCampo + (enc ? enc.alto + 8 : 0), true);
  return pie(ctx, cx, pagina, paginas, volver);
}

/* ------------------------------------------------------------------ */
/*  EL PDF                                                             */
/* ------------------------------------------------------------------ */

export type PdfJugador = { nombre: string; blob: Blob; acciones: number; paginas: number };

export async function cargaEscudos(rivalEscudo: string | undefined): Promise<Escudos> {
  const [nuestro, rival] = await Promise.all([
    cargaImagen("/logo.png").catch(() => null),
    rivalEscudo ? cargaImagen(rivalEscudo).catch(() => null) : Promise.resolve(null),
  ]);

  return { nuestro, rival };
}

/** La foto de una diapositiva, decodificada UNA vez para todos los PDF. */
export function imagenDeCaptura(dataUrl: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    if (!dataUrl) return resolve(null);

    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => resolve(null);
    imagen.src = dataUrl;
  });
}

/** Hace `trabajo` con todos, de `cuantos` en `cuantos` a la vez. */
export async function enParalelo<T>(todos: T[], cuantos: number, trabajo: (uno: T) => Promise<void>) {
  let siguiente = 0;

  await Promise.all(
    Array.from({ length: Math.min(cuantos, todos.length) }, async () => {
      while (siguiente < todos.length) await trabajo(todos[siguiente++]);
    }),
  );
}

/** Quita tildes y espacios para el nombre del fichero. */
function archivo(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

/* JPEG de la hoja: 0,78 deja el texto limpio y la hoja por debajo de ~150 KB. */
const CALIDAD = 0.78;

/**
 * El JPEG de una hoja. `toBlob` codifica fuera del hilo principal (la app
 * sigue respondiendo) y da los bytes sin pasar por base64.
 */
async function jpegDe(canvas: HTMLCanvasElement): Promise<Uint8Array | string> {
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise<Blob | null>((listo) => canvas.toBlob(listo, "image/jpeg", CALIDAD));

    if (blob) return new Uint8Array(await blob.arrayBuffer());
  }

  return canvas.toDataURL("image/jpeg", CALIDAD);
}

/**
 * Monta el PDF de un jugador. `tableros[i]` es la foto de la diapositiva de
 * `acciones[i]` (la misma para todos: el resalte se pinta aquí) y `puntos[i]`
 * dónde cae su cara en ella (1920×1080). `marcos[i]` dice cómo cae la
 * plantilla en esa foto (la pizarra acerca el campo a la jugada); `suyos`, el
 * nombre y la altura de cada dorsal del rival, para «Marcas al 4 Pérez».
 */
export async function pdfJugador(opciones: {
  player: Player | undefined;
  acciones: CometidoAccion[];
  tableros: (CanvasImageSource | null)[];
  puntos?: ({ x: number; y: number } | null)[];
  marcos?: (MarcoCaptura | null)[];
  suyos?: Map<string, SuJugador>;
  rival: string;
  jornada?: string;
  /** «YYYY-MM-DD» del partido, para el pie. */
  fecha?: string;
  escudos: Escudos;
}): Promise<PdfJugador> {
  const { jsPDF } = await import("jspdf");
  const { player, acciones } = opciones;

  const cx: Contexto = { player, rival: opciones.rival, jornada: opciones.jornada, fecha: opciones.fecha, escudos: opciones.escudos };

  const hojas: HTMLCanvasElement[] = [];
  const conResumen = acciones.length >= 2;
  const paginas = acciones.length + (conResumen ? 1 : 0);
  /* Los saltos (01/11/2026): cada fila del resumen a su hoja y, en cada hoja, la vuelta al resumen. */
  let filasResumen: ZonaHoja[] = [];
  const vueltas: (ZonaHoja | null)[] = [];

  if (conResumen) {
    const resumen = lienzo(altoResumen(acciones.length));

    filasResumen = dibujaResumen(resumen.ctx, cx, acciones, paginas);
    hojas.push(resumen.canvas);
  }

  acciones.forEach((accion, orden) => {
    const tablero = opciones.tableros[orden] ?? null;
    const marco = opciones.marcos?.[orden] ?? MARCO_PLANO;
    const plan = planAccion(accion, opciones.puntos?.[orden] ?? null, Boolean(tablero), marco, opciones.suyos);
    const hoja = lienzo(plan.alto);

    vueltas.push(dibujaAccion(hoja.ctx, cx, accion, tablero, plan, orden + 1, acciones.length, hojas.length + 1, paginas, conResumen));
    hojas.push(hoja.canvas);
  });

  const medidas = hojas.map((hoja) => [HOJA_W / 2, hoja.height / 2] as [number, number]);

  /* Todas las hojas se codifican a la vez; luego se suelta la memoria. */
  const jpegs = await Promise.all(hojas.map(jpegDe));

  hojas.forEach((hoja) => {
    hoja.width = 0;
    hoja.height = 0;
  });

  /* Cada hoja con su alto: jsPDF gira la página si la orientación no casa. */
  const orientacion = ([w, h]: [number, number]) => (h >= w ? "portrait" : "landscape");
  const doc = new jsPDF({ orientation: orientacion(medidas[0]), unit: "pt", format: medidas[0], compress: true });

  jpegs.forEach((jpeg, i) => {
    if (i) doc.addPage(medidas[i], orientacion(medidas[i]));
    doc.addImage(jpeg, "JPEG", 0, 0, medidas[i][0], medidas[i][1]);

    /* La hoja mide en el PDF la mitad que en píxeles. */
    const enPdf = (z: ZonaHoja, destino: number) => doc.link(z.x / 2, z.y / 2, z.w / 2, z.h / 2, { pageNumber: destino, top: 0 });

    if (conResumen && i === 0) filasResumen.forEach((zona, orden) => enPdf(zona, orden + 2));

    const vuelta = conResumen && i > 0 ? vueltas[i - 1] : null;

    if (vuelta) enPdf(vuelta, 1);
  });

  const quien = nombreCorto(player) || "jugador";

  doc.setProperties({ title: `Balón parado · ${quien} · ${opciones.rival}`, author: "RMCF Castilla" });

  const nombre = `ABP-${[player?.dorsal, archivo(quien), opciones.jornada, archivo(opciones.rival)]
    .filter((parte) => parte != null && parte !== "")
    .join("-")}.pdf`;

  return { nombre, blob: doc.output("blob"), acciones: acciones.length, paginas: jpegs.length };
}

/* ------------------------------------------------------------------ */
/*  PARA EL VÍDEO (lib/abp/video-jugador.ts)                           */
/* ------------------------------------------------------------------ */

export type { Contexto as ContextoJugador, Escudos };

/** El contexto y el retrato, cargados una vez para todos los fotogramas. */
export async function preparaJugador(opciones: {
  player: Player | undefined;
  rival: string;
  jornada?: string;
  escudos: Escudos;
}) {
  const foto = opciones.player?.fotoLejos || opciones.player?.foto;
  const retrato = foto ? await cargaImagen(foto).catch(() => null) : null;

  return { cx: { ...opciones } as Contexto, retrato };
}

export { renglones, escudo as pintaEscudo, archivo as nombreArchivo };
