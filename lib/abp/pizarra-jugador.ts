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
  lineasConsignas,
  normalizaConsigna,
  puestoDe,
  siglaDe,
  tituloVisible,
  type LadoPizarra,
  type LineaConsigna,
  type TableroPizarra,
} from "@/lib/abp/pizarra";
import type { TipoTrazo } from "@/lib/abp/trazos";
import {
  C,
  ajusta,
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
  con: string[];
  para: string;
  /** Sus fichas, sus flechas y el rival que marca, en coordenadas de la diapositiva. */
  foco: { x: number; y: number }[];
  /** Dónde está el rival que marca, si está dibujado. */
  marcaPunto: { x: number; y: number } | null;
  /** `despues` sale de una flecha dibujada (no del recordatorio por su papel). */
  despuesDibujado: boolean;
};

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

/** Las acciones en las que sale un jugador, en el orden de la charla. */
export function cometidosDe(
  tablero: TableroPizarra,
  playerId: string,
  players: Map<string, Player>,
): CometidoAccion[] {
  return tablero.slides.flatMap((slide, indice) => {
    const suyas = slide.fichas.filter((ficha) => ficha.playerId === playerId);

    if (suyas.length === 0) return [];

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
        consignas: consignasSuyas(lineasConsignas(slide.notas), claves, siglas),
        rival,
        despues: despues ? despues.charAt(0).toLocaleUpperCase("es-ES") + despues.slice(1).toLowerCase() : "",
        pasos,
        con: companeros,
        para: intencion ? intencion.replace(/\.$/, "") : "",
        foco,
        marcaPunto: marcaPunto ? { x: marcaPunto.x, y: marcaPunto.y } : null,
        despuesDibujado: Boolean(transicion),
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
| Cabecera mínima (01/11/2026, «mucha menos paja»): una franja con nuestro
| escudo, su dorsal y su nombre, y a la derecha la jornada y por dónde va. La
| portada grande con la foto se fue: el jugador abre el PDF para ver su tarea.
*/
const CABEZA_H = 132;

function cabecera(ctx: Ctx, cx: Contexto, marcador: string) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, HOJA_W, CABEZA_H);
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, CABEZA_H - 6, HOJA_W, 6);

  let x = MARGEN - 18;

  if (cx.escudos.nuestro) {
    encaja(ctx, cx.escudos.nuestro, x, 22, 82, 82);
    x += 102;
  }

  const dorsal = cx.player?.dorsal != null ? String(cx.player.dorsal).trim() : "";

  if (dorsal) {
    ctx.fillStyle = C.rosa;
    fuente(ctx, 84, 700);
    x += textoEspaciado(ctx, dorsal, x, 98, 0) + 18;
  }

  const contra = [cx.jornada, cx.rival ? `vs ${cx.rival}` : ""].filter(Boolean).join(" · ").toUpperCase();
  const derecha = HOJA_W - MARGEN;

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(247,244,236,.78)";
  const pxContra = ajusta(ctx, contra, 380, 30, 600, 0);
  const anchoContra = ctx.measureText(contra).width;
  ctx.fillText(contra, derecha, 56);

  ctx.fillStyle = C.rosa;
  fuente(ctx, 34, 700);
  const anchoMarcador = ctx.measureText(marcador).width;
  ctx.fillText(marcador, derecha, 102);
  ctx.textAlign = "left";

  const nombre = (nombreCorto(cx.player) || "Balón parado").toUpperCase();

  ctx.fillStyle = C.crema;
  ajusta(ctx, nombre, derecha - Math.max(anchoContra, anchoMarcador) - 30 - x, 66, 700, 1);
  textoEspaciado(ctx, nombre, x, 94, 1);

  return pxContra;
}

/* ----------------------------- resumen ----------------------------- */

/**
 * La primera hoja, cuando tiene dos acciones o más: todas de un vistazo, una
 * fila por acción con su sigla, su puesto y a quién marca. Es lo que se
 * relee en el autobús sin pasar páginas.
 */
const RESUMEN_Y = CABEZA_H + 186;
const RESUMEN_FILA = 150;
const altoResumen = (acciones: number) => RESUMEN_Y + acciones * RESUMEN_FILA + 30;

function dibujaResumen(ctx: Ctx, cx: Contexto, acciones: CometidoAccion[]) {
  cabecera(ctx, cx, `${acciones.length} ACCIONES`);

  ctx.fillStyle = C.navy;
  ajusta(ctx, "TU BALÓN PARADO", HOJA_W - MARGEN * 2, 96, 700, 2);
  textoEspaciado(ctx, "TU BALÓN PARADO", MARGEN, CABEZA_H + 122, 2);
  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, CABEZA_H + 142, 200, 10);

  const y0 = RESUMEN_Y;
  const fila = RESUMEN_FILA;
  const alto = fila - 14;

  acciones.forEach((accion, orden) => {
    const top = y0 + orden * fila;

    ctx.fillStyle = C.crema;
    rectRedondo(ctx, MARGEN, top, HOJA_W - MARGEN * 2, alto, 18);
    ctx.fill();
    ctx.fillStyle = colorLado(accion.lado);
    rectRedondo(ctx, MARGEN, top, 12, alto, 6);
    ctx.fill();

    /* La sigla, que es lo que busca en la pizarra. */
    const r = Math.min(48, alto * 0.36);
    const discoX = MARGEN + 40 + r;
    const sigla = accion.puestos.map((p) => p.sigla).join("·") || "★";

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
    const detalle = [accion.puestos.map((p) => p.label).join(" · "), accion.rival].filter(Boolean).join(" · ").toUpperCase();

    ctx.fillStyle = C.navy;
    ajusta(ctx, accion.titulo.toUpperCase(), maxW, Math.min(46, alto * 0.36), 700, 1);
    textoEspaciado(ctx, accion.titulo.toUpperCase(), tx, top + (detalle ? alto * 0.47 : alto / 2 + 14), 1);

    if (detalle) {
      ctx.fillStyle = accion.lado === "ofensivo" ? C.verde : "#7A1F2B";
      ajusta(ctx, detalle, maxW, Math.min(34, alto * 0.27), 600, 1);
      textoEspaciado(ctx, detalle, tx, top + alto * 0.8, 1);
    }
  });

  filoRosa(ctx);
}

/* ----------------------------- una acción ----------------------------- */

/** Dónde empieza el campo en la diapositiva (debajo de su título). */
const CAMPO_ARRIBA = CABECERA_SLIDE;
/** El panel de puestos de la derecha: si él no está ahí, no se enseña. */
const CAMPO_DERECHA = 1516;
const TABLERO_Y = CABEZA_H + 166;

type Encuadre = { sx: number; sy: number; sw: number; sh: number; alto: number };

/**
 * El trozo de la diapositiva que le importa (01/11/2026): sus fichas, sus
 * flechas y el rival que marca, con aire alrededor. Antes iba la diapositiva
 * entera a lo ancho de la hoja y su cara medía un dedo; así sale casi al
 * doble y fuera queda el título y el panel, que ya están escritos debajo.
 */
function encuadre(puntos: { x: number; y: number }[]): Encuadre {
  const altoCampo = TABLERO_H - CAMPO_ARRIBA;

  if (puntos.length === 0) {
    return { sx: 0, sy: CAMPO_ARRIBA, sw: TABLERO_W, sh: altoCampo, alto: Math.round((HOJA_W * altoCampo) / TABLERO_W) };
  }

  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  /* Nunca menos de 3/5 de la diapositiva: la referencia del área y la portería. */
  const w = Math.min(TABLERO_W, Math.max(maxX - minX + 360, 1150));
  const h = Math.min(altoCampo, Math.max(maxY - minY + 380, w * 0.8));
  const alto = Math.round((HOJA_W * h) / w);

  const tope = maxX < CAMPO_DERECHA && w <= CAMPO_DERECHA ? CAMPO_DERECHA : TABLERO_W;
  const centroX = (minX + maxX) / 2;
  /* Algo hacia arriba: la cara va por encima de los pies. */
  const centroY = (minY + maxY) / 2 - 30;

  return {
    sx: Math.max(0, Math.min(tope - w, centroX - w / 2)),
    sy: Math.max(CAMPO_ARRIBA, Math.min(TABLERO_H - h, centroY - h / 2)),
    sw: w,
    sh: h,
    alto,
  };
}

/**
 * Él en foco y el resto en penumbra; su hombre, también con luz. La foto del
 * tablero es la misma para los once (se hace una vez): el resalte va aquí.
 */
function resalta(
  ctx: Ctx,
  enc: Encuadre,
  punto: { x: number; y: number } | null,
  accion: CometidoAccion,
) {
  const z = HOJA_W / enc.sw;
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
  const suyo = accion.marcaPunto ? enHoja({ x: accion.marcaPunto.x, y: accion.marcaPunto.y - 30 }) : null;

  if (yo) luz(yo, 80 * z, 260 * z);
  if (suyo) luz(suyo, 50 * z, 150 * z);

  if (yo || suyo) ctx.drawImage(capa, 0, TABLERO_Y);

  capa.width = 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TABLERO_Y, HOJA_W, enc.alto);
  ctx.clip();

  if (suyo) {
    const radio = 46 * z;

    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(suyo.x, TABLERO_Y + suyo.y, radio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    chapa(ctx, accion.rival.startsWith("Marcas") ? "TU HOMBRE" : "TE VIGILA", {
      x: suyo.x,
      y: Math.min(TABLERO_Y + enc.alto - 48, TABLERO_Y + suyo.y + radio + 10),
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
    const radio = 50 * z;

    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(yo.x, TABLERO_Y + yo.y, radio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = C.rosa;
    ctx.lineWidth = 8;
    ctx.stroke();

    chapa(ctx, "TÚ", {
      x: yo.x,
      y: Math.max(TABLERO_Y + 10, TABLERO_Y + yo.y - radio - 56),
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

/** Lo que hace, por fases si tiene más de una: «Fase 1: bloqueas · fase 2: atacas». */
function queHaces(accion: CometidoAccion) {
  const fases = new Set(accion.pasos.map((p) => p.fase));
  const hacer =
    fases.size > 1
      ? accion.pasos.map((p, i) => `${i ? "fase" : "Fase"} ${p.fase}: ${p.verbo.toLowerCase()}`).join(" · ")
      : lista([...new Set(accion.pasos.map((p) => p.verbo))].map((v, i) => (i ? v.toLowerCase() : v)));

  const con = accion.con.length ? `${hacer ? "con" : "junto a"} ${lista(accion.con)}` : "";

  return mayuscula([hacer, con].filter(Boolean).join(" "));
}

/**
 * El texto de debajo del campo. Con `pinta` en falso sólo mide: el campo
 * se queda con el sitio que el texto no usa.
 */
function bloqueTarea(ctx: Ctx, accion: CometidoAccion, y0: number, pinta: boolean) {
  let y = y0 + 40;
  const ancho = HOJA_W - MARGEN * 2;

  /* DÓNDE: la sigla en un disco y el puesto; al lado, a quién marca. */
  const sigla = accion.puestos.map((p) => p.sigla).join("·") || "★";
  const puesto = accion.puestos.map((p) => p.label).join(" · ").toUpperCase();
  const r = 66;
  const tx = MARGEN + r * 2 + 30;

  if (pinta) {
    ctx.fillStyle = C.rosa;
    ctx.beginPath();
    ctx.arc(MARGEN + r, y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.navy;
    const px = ajusta(ctx, sigla, r * 1.6, 84, 700, 0);
    ctx.textAlign = "center";
    ctx.fillText(sigla, MARGEN + r, y + r + px * 0.35);
    ctx.textAlign = "left";

    if (puesto) {
      ctx.fillStyle = C.navy;
      ajusta(ctx, puesto, HOJA_W - MARGEN - tx, 64, 700, 1);
      textoEspaciado(ctx, puesto, tx, y + (accion.rival ? 58 : r + 22), 1);
    }

    if (accion.rival) {
      chapa(ctx, accion.rival.toUpperCase(), {
        x: tx,
        y: y + (puesto ? 78 : r - 28),
        alto: 56,
        fondo: "#7A1F2B",
        tinta: C.crema,
        tamano: 34,
        espaciado: 2,
        padding: 22,
        anchoMax: HOJA_W - MARGEN - tx,
      });
    }
  }

  y += r * 2 + 26;

  /* QUÉ HACE y PARA QUÉ: letra grande, que se lee en el móvil. */
  const tarea = queHaces(accion);
  const lineas: { texto: string; color: string; px: number; peso: 500 | 600 | 700 }[] = [];

  fuente(ctx, 52, 700);
  if (tarea) renglones(ctx, tarea, ancho).forEach((texto) => lineas.push({ texto, color: C.navy, px: 52, peso: 700 }));

  fuente(ctx, 46, 600);
  if (accion.para) {
    renglones(ctx, `Para ${minuscula(accion.para)}`, ancho).forEach((texto) =>
      lineas.push({ texto, color: colorLado(accion.lado), px: 46, peso: 600 }),
    );
  }

  for (const linea of lineas) {
    y += linea.px * 1.22;

    if (pinta) {
      ctx.fillStyle = linea.color;
      fuente(ctx, linea.px, linea.peso);
      ctx.fillText(linea.texto, MARGEN, y);
    }
  }

  if (lineas.length) y += 26;

  /* La señal (ofensivas), lo que le toca y lo que viene después: con su chapa. */
  const notas: { rotulo: string; fondo: string; tinta: string; texto: string }[] = [
    ...(accion.senal ? [{ rotulo: "SEÑAL", fondo: C.navy, tinta: C.crema, texto: accion.senal }] : []),
    ...accion.consignas.map((texto) => ({ rotulo: "OJO", fondo: C.rosa, tinta: C.navy, texto })),
    ...(accion.despuesDibujado && accion.despues
      ? [{ rotulo: "DESPUÉS", fondo: C.verde, tinta: C.crema, texto: accion.despues }]
      : []),
  ];

  const sangria = 170;

  for (const nota of notas) {
    fuente(ctx, 42, 500);
    const filas = renglones(ctx, nota.texto, ancho - sangria);

    if (pinta) {
      chapa(ctx, nota.rotulo, {
        x: MARGEN,
        y: y + 6,
        alto: 44,
        fondo: nota.fondo,
        tinta: nota.tinta,
        tamano: 24,
        espaciado: 3,
        padding: 16,
        anchoMin: sangria - 22,
      });

      ctx.fillStyle = C.navy;
      fuente(ctx, 42, 500);
      filas.forEach((fila, i) => ctx.fillText(fila, MARGEN + sangria, y + 42 + i * 52));
    }

    y += Math.max(56, filas.length * 52) + 22;
  }

  return y;
}

/** Lo que mide la hoja de una acción, antes de pintarla. */
function planAccion(accion: CometidoAccion, punto: { x: number; y: number } | null, conTablero: boolean) {
  const yo = punto ?? (accion.foco[0] ? { x: accion.foco[0].x, y: accion.foco[0].y - 50 } : null);
  const enc = conTablero ? encuadre([...accion.foco, ...(yo ? [yo] : [])]) : null;
  const yTexto = TABLERO_Y + (enc ? enc.alto + 8 : 0);
  const alto = bloqueTarea(midiendo(), accion, yTexto, false) + 24;

  return { yo, enc, yTexto, alto };
}

function dibujaAccion(
  ctx: Ctx,
  cx: Contexto,
  accion: CometidoAccion,
  tablero: CanvasImageSource | null,
  plan: ReturnType<typeof planAccion>,
  orden: number,
  total: number,
) {
  cabecera(ctx, cx, total > 1 ? `ACCIÓN ${orden} DE ${total}` : "BALÓN PARADO");

  /* El lado y el título de la acción. */
  chapa(ctx, LADO_PIZARRA_LABEL[accion.lado].toUpperCase(), {
    x: MARGEN,
    y: CABEZA_H + 24,
    alto: 42,
    fondo: accion.lado === "ofensivo" ? C.verde : C.rosa,
    tinta: accion.lado === "ofensivo" ? C.crema : C.navy,
    tamano: 24,
    espaciado: 3,
    padding: 18,
  });

  ctx.fillStyle = C.navy;
  const titulo = accion.titulo.toUpperCase();
  ajusta(ctx, titulo, HOJA_W - MARGEN * 2, 76, 700, 1);
  textoEspaciado(ctx, titulo, MARGEN, CABEZA_H + 140, 1);

  /* El campo, encuadrado en lo suyo y con él en foco. */
  const { enc, yo, yTexto } = plan;

  if (tablero && enc) {
    const k = ("width" in tablero ? Number(tablero.width) : TABLERO_W) / TABLERO_W;

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tablero, enc.sx * k, enc.sy * k, enc.sw * k, enc.sh * k, 0, TABLERO_Y, HOJA_W, enc.alto);
    resalta(ctx, enc, yo, accion);

    ctx.fillStyle = C.rosa;
    ctx.fillRect(0, TABLERO_Y + enc.alto, HOJA_W, 8);
  }

  bloqueTarea(ctx, accion, yTexto, true);
  filoRosa(ctx);
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
 * dónde cae su cara en ella (1920×1080).
 */
export async function pdfJugador(opciones: {
  player: Player | undefined;
  acciones: CometidoAccion[];
  tableros: (CanvasImageSource | null)[];
  puntos?: ({ x: number; y: number } | null)[];
  rival: string;
  jornada?: string;
  escudos: Escudos;
}): Promise<PdfJugador> {
  const { jsPDF } = await import("jspdf");
  const { player, acciones } = opciones;

  const cx: Contexto = { player, rival: opciones.rival, jornada: opciones.jornada, escudos: opciones.escudos };

  const hojas: HTMLCanvasElement[] = [];

  if (acciones.length >= 2) {
    const resumen = lienzo(altoResumen(acciones.length));

    dibujaResumen(resumen.ctx, cx, acciones);
    hojas.push(resumen.canvas);
  }

  acciones.forEach((accion, orden) => {
    const tablero = opciones.tableros[orden] ?? null;
    const plan = planAccion(accion, opciones.puntos?.[orden] ?? null, Boolean(tablero));
    const hoja = lienzo(plan.alto);

    dibujaAccion(hoja.ctx, cx, accion, tablero, plan, orden + 1, acciones.length);
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
